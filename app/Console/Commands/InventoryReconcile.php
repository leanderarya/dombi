<?php

namespace App\Console\Commands;

use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class InventoryReconcile extends Command
{
    protected $signature = 'inventory:reconcile
        {--fix : Apply corrections to mismatched inventory}
        {--dry-run : Report only, no modifications}
        {--outlet= : Only check specific outlet ID}';

    protected $description = 'Reconcile inventory: verify center stock + outlet stock against StockMovement history (variant-aware)';

    private int $centerChecked = 0;

    private int $centerDrifted = 0;

    private int $outletChecked = 0;

    private int $outletDrifted = 0;

    private int $fixed = 0;

    private array $drifts = [];

    private array $conservationViolations = [];

    public function handle(): int
    {
        $fix = $this->option('fix') && ! $this->option('dry-run');
        $outletFilter = $this->option('outlet') ? (int) $this->option('outlet') : null;

        $this->newLine();
        $this->info('=== INVENTORY RECONCILIATION ===');
        $this->info('Mode: '.($fix ? 'FIX' : ($this->option('dry-run') ? 'DRY RUN' : 'REPORT')));
        if ($outletFilter) {
            $this->info("Outlet filter: {$outletFilter}");
        }
        $this->newLine();

        $this->reconcileCenterStock($fix);
        $this->reconcileOutletStock($fix, $outletFilter);
        $this->auditConservation($outletFilter);
        $this->printReport($fix);

        return $this->centerDrifted + $this->outletDrifted + count($this->conservationViolations) > 0
            ? self::FAILURE
            : self::SUCCESS;
    }

    // ─── CENTER STOCK RECONCILIATION ──────────────────────────────

    private function reconcileCenterStock(bool $fix): void
    {
        $this->info('Checking center inventory...');

        $variants = ProductVariant::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        $bar = $this->output->createProgressBar($variants->count());
        $bar->start();

        foreach ($variants as $variant) {
            $bar->advance();
            $this->centerChecked++;

            $expected = $this->computeExpectedCenterStock($variant->id);

            // Skip if no center movements exist (stored value is baseline)
            if ($expected === null) {
                continue;
            }

            $actual = (int) $variant->center_stock;
            $drift = $actual - $expected;

            if ($drift !== 0) {
                $this->centerDrifted++;
                $this->drifts[] = [
                    'location' => 'CENTER',
                    'variant' => $variant->full_name,
                    'variant_id' => $variant->id,
                    'outlet_id' => null,
                    'expected' => $expected,
                    'actual' => $actual,
                    'drift' => $drift,
                ];

                if ($fix) {
                    $this->fixCenterStock($variant, $expected);
                    $this->fixed++;
                }
            }
        }

        $bar->finish();
        $this->newLine();
    }

    private function computeExpectedCenterStock(int $variantId): ?int
    {
        $hasMovements = StockMovement::query()
            ->where('product_variant_id', $variantId)
            ->whereIn('type', ['distribution_out', 'return_in', 'exchange_out'])
            ->exists();

        // If no center movements exist, treat stored value as baseline
        if (! $hasMovements) {
            return null; // null = no check possible
        }

        $movements = StockMovement::query()
            ->where('product_variant_id', $variantId)
            ->whereIn('type', ['distribution_out', 'return_in', 'exchange_out'])
            ->orderBy('id')
            ->get();

        $stock = 0;
        foreach ($movements as $m) {
            $stock += (int) $m->quantity;
        }

        return max(0, $stock);
    }

    private function fixCenterStock(ProductVariant $variant, int $expected): void
    {
        DB::transaction(function () use ($variant, $expected) {
            $variant = ProductVariant::query()->lockForUpdate()->findOrFail($variant->id);

            $before = (int) $variant->center_stock;
            $variant->update(['center_stock' => $expected]);

            StockMovement::create([
                'outlet_id' => null,
                'product_variant_id' => $variant->id,
                'type' => 'stock_adjustment',
                'quantity' => $expected - $before,
                'before_stock' => $before,
                'after_stock' => $expected,
                'before_reserved' => 0,
                'after_reserved' => 0,
                'notes' => 'Center stock reconciliation correction',
                'created_by' => null,
            ]);
        });
    }

    // ─── OUTLET STOCK RECONCILIATION ──────────────────────────────

    private function reconcileOutletStock(bool $fix, ?int $outletFilter): void
    {
        $this->info('Checking outlet inventory...');

        $query = OutletInventory::query()
            ->with('variant')
            ->orderBy('outlet_id')
            ->orderBy('product_variant_id');

        if ($outletFilter) {
            $query->where('outlet_id', $outletFilter);
        }

        $inventories = $query->get();

        $bar = $this->output->createProgressBar($inventories->count());
        $bar->start();

        foreach ($inventories as $inventory) {
            $bar->advance();
            $this->outletChecked++;

            $expectedCurrent = $this->computeExpectedOutletStock(
                $inventory->outlet_id,
                $inventory->product_variant_id
            );

            $expectedReserved = $this->computeExpectedReservedStock(
                $inventory->outlet_id,
                $inventory->product_variant_id
            );

            $currentDrift = $inventory->current_stock - $expectedCurrent;
            $reservedDrift = $inventory->reserved_stock - $expectedReserved;

            if ($currentDrift !== 0 || $reservedDrift !== 0) {
                $this->outletDrifted++;
                $variantName = $inventory->variant?->full_name ?? "variant #{$inventory->product_variant_id}";

                $this->drifts[] = [
                    'location' => "OUTLET #{$inventory->outlet_id}",
                    'variant' => $variantName,
                    'variant_id' => $inventory->product_variant_id,
                    'outlet_id' => $inventory->outlet_id,
                    'expected_current' => $expectedCurrent,
                    'actual_current' => $inventory->current_stock,
                    'current_drift' => $currentDrift,
                    'expected_reserved' => $expectedReserved,
                    'actual_reserved' => $inventory->reserved_stock,
                    'reserved_drift' => $reservedDrift,
                    'root_cause' => $this->analyzeRootCause($inventory, $expectedCurrent, $expectedReserved),
                ];

                if ($fix) {
                    $this->fixOutletStock($inventory, $expectedCurrent, $expectedReserved);
                    $this->fixed++;
                }
            }
        }

        $bar->finish();
        $this->newLine();
    }

    private function computeExpectedOutletStock(int $outletId, int $variantId): int
    {
        $movements = StockMovement::query()
            ->where('outlet_id', $outletId)
            ->where('product_variant_id', $variantId)
            ->whereIn('type', [
                'initial_stock',
                'stock_adjustment',
                'restock_in',
                'order_completed',
                'return_out',
                'exchange_in',
                'delivery_returned',
            ])
            ->orderBy('id')
            ->get();

        $stock = 0;
        foreach ($movements as $m) {
            $stock += (int) $m->quantity;
        }

        return max(0, $stock);
    }

    private function computeExpectedReservedStock(int $outletId, int $variantId): int
    {
        return (int) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.outlet_id', $outletId)
            ->where('order_items.product_variant_id', $variantId)
            ->whereIn('orders.status', [
                'pending_confirmation',
                'confirmed',
                'preparing',
                'ready_for_pickup',
                'picked_up',
                'delivering',
            ])
            ->sum('order_items.quantity');
    }

    private function fixOutletStock(OutletInventory $inventory, int $expectedCurrent, int $expectedReserved): void
    {
        DB::transaction(function () use ($inventory, $expectedCurrent, $expectedReserved) {
            $inventory = OutletInventory::query()->lockForUpdate()->findOrFail($inventory->id);

            $beforeCurrent = $inventory->current_stock;
            $beforeReserved = $inventory->reserved_stock;

            $inventory->update([
                'current_stock' => $expectedCurrent,
                'reserved_stock' => $expectedReserved,
            ]);

            StockMovement::create([
                'outlet_id' => $inventory->outlet_id,
                'product_variant_id' => $inventory->product_variant_id,
                'type' => 'stock_adjustment',
                'quantity' => $expectedCurrent - $beforeCurrent,
                'before_stock' => $beforeCurrent,
                'after_stock' => $expectedCurrent,
                'before_reserved' => $beforeReserved,
                'after_reserved' => $expectedReserved,
                'notes' => 'Outlet inventory reconciliation correction',
                'created_by' => null,
            ]);
        });
    }

    // ─── ROOT CAUSE ANALYSIS ──────────────────────────────────────

    private function analyzeRootCause(OutletInventory $inventory, int $expectedCurrent, int $expectedReserved): string
    {
        $currentDrift = $inventory->current_stock - $expectedCurrent;
        $reservedDrift = $inventory->reserved_stock - $expectedReserved;

        $causes = [];

        // Check for movements without product_variant_id (legacy)
        $legacyMovements = StockMovement::query()
            ->where('outlet_id', $inventory->outlet_id)
            ->where('product_id', $inventory->product_id)
            ->whereNull('product_variant_id')
            ->count();

        if ($legacyMovements > 0) {
            $causes[] = "{$legacyMovements} legacy movement(s) without variant ID";
        }

        // Check for duplicate movements (same reference)
        $duplicateRefs = StockMovement::query()
            ->where('outlet_id', $inventory->outlet_id)
            ->where('product_variant_id', $inventory->product_variant_id)
            ->select('reference_type', 'reference_id', 'type')
            ->groupBy('reference_type', 'reference_id', 'type')
            ->havingRaw('COUNT(*) > 1')
            ->count();

        if ($duplicateRefs > 0) {
            $causes[] = "{$duplicateRefs} duplicate movement reference(s)";
        }

        // Check for missing reserved adjustments
        if ($reservedDrift > 0) {
            $causes[] = 'Reserved stock higher than expected - possible missing cancellation';
        } elseif ($reservedDrift < 0) {
            $causes[] = 'Reserved stock lower than expected - possible over-release';
        }

        // Check for manual stock adjustments
        $adjustments = StockMovement::query()
            ->where('outlet_id', $inventory->outlet_id)
            ->where('product_variant_id', $inventory->product_variant_id)
            ->where('type', 'stock_adjustment')
            ->count();

        if ($adjustments > 0) {
            $causes[] = "{$adjustments} manual stock adjustment(s) on record";
        }

        if (empty($causes)) {
            $causes[] = 'Unknown - possible broken transaction or missing movement';
        }

        return implode('; ', $causes);
    }

    // ─── CONSERVATION AUDIT ───────────────────────────────────────

    private function auditConservation(?int $outletFilter): void
    {
        $this->info('Checking center + outlet conservation...');

        $variants = ProductVariant::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        foreach ($variants as $variant) {
            $centerStock = (int) $variant->center_stock;

            $outletQuery = OutletInventory::query()
                ->where('product_variant_id', $variant->id);

            if ($outletFilter) {
                $outletQuery->where('outlet_id', $outletFilter);
            }

            $outletStock = (int) $outletQuery->sum('current_stock');

            // Expected total from movements
            $expectedTotal = $this->computeTotalExpectedStock($variant->id, $outletFilter);
            $actualTotal = $centerStock + $outletStock;

            if ($expectedTotal !== null && $actualTotal !== $expectedTotal) {
                $this->conservationViolations[] = [
                    'variant' => $variant->full_name,
                    'variant_id' => $variant->id,
                    'center' => $centerStock,
                    'outlet' => $outletStock,
                    'actual_total' => $actualTotal,
                    'expected_total' => $expectedTotal,
                    'drift' => $actualTotal - $expectedTotal,
                ];
            }
        }
    }

    private function computeTotalExpectedStock(int $variantId, ?int $outletFilter): ?int
    {
        // Check if any movements exist at all
        $hasMovements = StockMovement::query()
            ->where('product_variant_id', $variantId)
            ->exists();

        if (! $hasMovements) {
            return null; // No movements = can't compute expected
        }

        // All movements affect total inventory
        $query = StockMovement::query()
            ->where('product_variant_id', $variantId);

        if ($outletFilter) {
            $query->where(function ($q) use ($outletFilter) {
                $q->where('outlet_id', $outletFilter)
                    ->orWhereNull('outlet_id');
            });
        }

        return max(0, (int) $query->sum('quantity'));
    }

    // ─── REPORT ───────────────────────────────────────────────────

    private function printReport(bool $fix): void
    {
        $this->newLine();
        $this->info('=== RECONCILIATION REPORT ===');
        $this->newLine();

        // Center
        $this->info('CENTER INVENTORY');
        $this->info('----------------');
        $this->info("Checked: {$this->centerChecked} variants");
        $this->info('Healthy: '.($this->centerChecked - $this->centerDrifted));
        $this->line("Drifted: <comment>{$this->centerDrifted}</comment>");
        $this->newLine();

        // Outlet
        $this->info('OUTLET INVENTORY');
        $this->info('----------------');
        $this->info("Checked: {$this->outletChecked} inventories");
        $this->info('Healthy: '.($this->outletChecked - $this->outletDrifted));
        $this->line("Drifted: <comment>{$this->outletDrifted}</comment>");
        $this->newLine();

        // Drift details
        if (! empty($this->drifts)) {
            $this->warn('DRIFT DETECTED');
            $this->warn('--------------');

            foreach ($this->drifts as $d) {
                $this->newLine();
                $this->line("  <comment>{$d['variant']}</comment>");
                $this->line("  Location: {$d['location']}");

                if (isset($d['expected_current'])) {
                    // Outlet drift
                    $this->table(
                        ['Field', 'Expected', 'Actual', 'Drift'],
                        [
                            ['current_stock', $d['expected_current'], $d['actual_current'], $d['current_drift']],
                            ['reserved_stock', $d['expected_reserved'], $d['actual_reserved'], $d['reserved_drift']],
                        ]
                    );
                    if (! empty($d['root_cause'])) {
                        $this->line("  Likely cause: <fg=red>{$d['root_cause']}</>");
                    }
                } else {
                    // Center drift
                    $this->table(
                        ['Field', 'Expected', 'Actual', 'Drift'],
                        [
                            ['center_stock', $d['expected'], $d['actual'], $d['drift']],
                        ]
                    );
                }
            }
        }

        // Conservation
        if (! empty($this->conservationViolations)) {
            $this->newLine();
            $this->error('CONSERVATION VIOLATIONS');
            $this->error('-----------------------');

            foreach ($this->conservationViolations as $cv) {
                $this->newLine();
                $this->line("  <comment>{$cv['variant']}</comment>");
                $this->line("  Center: {$cv['center']}  Outlet: {$cv['outlet']}  Total: {$cv['actual_total']}");
                $this->line("  Expected total: {$cv['expected_total']}  Drift: <fg=red>{$cv['drift']}</>");
            }
        }

        // Summary
        $this->newLine();
        $totalDrift = $this->centerDrifted + $this->outletDrifted;
        $conservation = count($this->conservationViolations);

        if ($totalDrift === 0 && $conservation === 0) {
            $this->info('✓ All inventory is consistent. No drift detected.');
        } else {
            $this->warn("Drift: {$totalDrift} record(s)  Conservation violations: {$conservation}");
            if (! $fix) {
                $this->warn('Run with --fix to apply corrections.');
            } else {
                $this->info("Fixed: {$this->fixed} record(s)");
            }
        }

        $this->newLine();
    }
}
