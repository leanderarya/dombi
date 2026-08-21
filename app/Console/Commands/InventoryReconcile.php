<?php

namespace App\Console\Commands;

use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class InventoryReconcile extends Command
{
    protected $signature = 'inventory:reconcile
        {--fix : Apply corrections to mismatched inventory}
        {--dry-run : Report only, no modifications}
        {--outlet= : Only check specific outlet ID}';

    protected $description = 'Reconcile inventory: verify center stock + outlet stock against StockMovement history';

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

    private function reconcileCenterStock(bool $fix): void
    {
        $this->info('Checking center inventory...');

        $products = Product::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        $bar = $this->output->createProgressBar($products->count());
        $bar->start();

        foreach ($products as $product) {
            $bar->advance();
            $this->centerChecked++;

            $expected = $this->computeExpectedCenterStock($product->id);

            if ($expected === null) {
                continue;
            }

            $actual = (int) $product->center_stock;
            $drift = $actual - $expected;

            if ($drift !== 0) {
                $this->centerDrifted++;
                $this->drifts[] = [
                    'location' => 'CENTER',
                    'product' => $product->full_display_name,
                    'product_id' => $product->id,
                    'outlet_id' => null,
                    'expected' => $expected,
                    'actual' => $actual,
                    'drift' => $drift,
                ];

                if ($fix) {
                    $this->fixCenterStock($product, $expected);
                    $this->fixed++;
                }
            }
        }

        $bar->finish();
        $this->newLine();
    }

    private function computeExpectedCenterStock(int $productId): ?int
    {
        $hasMovements = StockMovement::query()
            ->where('product_id', $productId)
            ->where(function ($q) {
                $q->whereNull('outlet_id')
                    ->whereIn('type', ['initial_stock', 'stock_adjustment']);
            })
            ->orWhere(function ($q) use ($productId) {
                $q->where('product_id', $productId)
                    ->whereIn('type', ['distribution_out', 'return_in', 'exchange_out']);
            })
            ->where(function ($q) {
                $q->whereNull('notes')->orWhere('notes', 'NOT LIKE', '%reconciliation correction%');
            })
            ->exists();

        if (! $hasMovements) {
            return null;
        }

        $baseline = (int) StockMovement::query()
            ->where('product_id', $productId)
            ->whereNull('outlet_id')
            ->whereIn('type', ['initial_stock', 'stock_adjustment'])
            ->where(function ($q) {
                $q->whereNull('notes')->orWhere('notes', 'NOT LIKE', '%reconciliation correction%');
            })
            ->sum('quantity');

        $transfers = (int) StockMovement::query()
            ->where('product_id', $productId)
            ->whereIn('type', ['distribution_out', 'return_in', 'exchange_out'])
            ->where(function ($q) {
                $q->whereNull('notes')->orWhere('notes', 'NOT LIKE', '%reconciliation correction%');
            })
            ->sum('quantity');

        return max(0, $baseline + $transfers);
    }

    private function fixCenterStock(Product $product, int $expected): void
    {
        DB::transaction(function () use ($product, $expected) {
            $product = Product::query()->lockForUpdate()->findOrFail($product->id);

            $before = (int) $product->center_stock;
            $product->update(['center_stock' => $expected]);

            StockMovement::create([
                'outlet_id' => null,
                'product_id' => $product->id,
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

    private function reconcileOutletStock(bool $fix, ?int $outletFilter): void
    {
        $this->info('Checking outlet inventory...');

        $query = OutletInventory::query()
            ->with('product')
            ->orderBy('outlet_id')
            ->orderBy('product_id');

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
                $inventory->product_id
            );

            $expectedReserved = $this->computeExpectedReservedStock(
                $inventory->outlet_id,
                $inventory->product_id
            );

            $currentDrift = $inventory->current_stock - $expectedCurrent;
            $reservedDrift = $inventory->reserved_stock - $expectedReserved;

            if ($currentDrift !== 0 || $reservedDrift !== 0) {
                $this->outletDrifted++;
                $productName = $inventory->product?->full_display_name ?? "product #{$inventory->product_id}";

                $this->drifts[] = [
                    'location' => "OUTLET #{$inventory->outlet_id}",
                    'product' => $productName,
                    'product_id' => $inventory->product_id,
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

    private function computeExpectedOutletStock(int $outletId, int $productId): int
    {
        $movements = StockMovement::query()
            ->where('outlet_id', $outletId)
            ->where('product_id', $productId)
            ->whereIn('type', [
                'initial_stock',
                'stock_adjustment',
                'stock_opname',
                'restock_in',
                'order_completed',
                'return_out',
                'exchange_in',
                'delivery_returned',
            ])
            ->where(function ($q) {
                $q->whereNull('notes')->orWhere('notes', 'NOT LIKE', '%reconciliation correction%');
            })
            ->orderBy('id')
            ->get();

        $stock = 0;
        foreach ($movements as $m) {
            $stock += (int) $m->quantity;
        }

        return max(0, $stock);
    }

    private function computeExpectedReservedStock(int $outletId, int $productId): int
    {
        return (int) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.outlet_id', $outletId)
            ->where('order_items.product_id', $productId)
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
                'product_id' => $inventory->product_id,
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

    private function analyzeRootCause(OutletInventory $inventory, int $expectedCurrent, int $expectedReserved): string
    {
        $currentDrift = $inventory->current_stock - $expectedCurrent;
        $reservedDrift = $inventory->reserved_stock - $expectedReserved;

        $causes = [];

        $legacyMovements = StockMovement::query()
            ->where('outlet_id', $inventory->outlet_id)
            ->whereNull('product_id')
            ->count();

        if ($legacyMovements > 0) {
            $causes[] = "{$legacyMovements} legacy movement(s) without product ID";
        }

        $duplicateRefs = StockMovement::query()
            ->where('outlet_id', $inventory->outlet_id)
            ->where('product_id', $inventory->product_id)
            ->select('reference_type', 'reference_id', 'type')
            ->groupBy('reference_type', 'reference_id', 'type')
            ->havingRaw('COUNT(*) > 1')
            ->count();

        if ($duplicateRefs > 0) {
            $causes[] = "{$duplicateRefs} duplicate movement reference(s)";
        }

        if ($reservedDrift > 0) {
            $causes[] = 'Reserved stock higher than expected - possible missing cancellation';
        } elseif ($reservedDrift < 0) {
            $causes[] = 'Reserved stock lower than expected - possible over-release';
        }

        $adjustments = StockMovement::query()
            ->where('outlet_id', $inventory->outlet_id)
            ->where('product_id', $inventory->product_id)
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

    private function auditConservation(?int $outletFilter): void
    {
        $this->info('Checking center + outlet conservation...');

        $products = Product::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        foreach ($products as $product) {
            $centerStock = (int) $product->center_stock;

            $outletQuery = OutletInventory::query()
                ->where('product_id', $product->id);

            if ($outletFilter) {
                $outletQuery->where('outlet_id', $outletFilter);
            }

            $outletStock = (int) $outletQuery->sum('current_stock');

            $expectedTotal = $this->computeTotalExpectedStock($product->id, $outletFilter);
            $actualTotal = $centerStock + $outletStock;

            if ($expectedTotal !== null && $actualTotal !== $expectedTotal) {
                $this->conservationViolations[] = [
                    'product' => $product->full_display_name,
                    'product_id' => $product->id,
                    'center' => $centerStock,
                    'outlet' => $outletStock,
                    'actual_total' => $actualTotal,
                    'expected_total' => $expectedTotal,
                    'drift' => $actualTotal - $expectedTotal,
                ];
            }
        }
    }

    private function computeTotalExpectedStock(int $productId, ?int $outletFilter): ?int
    {
        $hasMovements = StockMovement::query()
            ->where('product_id', $productId)
            ->where(function ($q) {
                $q->whereNull('notes')->orWhere('notes', 'NOT LIKE', '%reconciliation correction%');
            })
            ->exists();

        if (! $hasMovements) {
            return null;
        }

        $query = StockMovement::query()
            ->where('product_id', $productId)
            ->where(function ($q) {
                $q->whereNull('notes')->orWhere('notes', 'NOT LIKE', '%reconciliation correction%');
            })
            ->whereNotIn('type', ['order_reserved', 'order_cancelled', 'in_transit']);

        if ($outletFilter) {
            $query->where(function ($q) use ($outletFilter) {
                $q->where('outlet_id', $outletFilter)
                    ->orWhereNull('outlet_id');
            });
        }

        return max(0, (int) $query->sum('quantity'));
    }

    private function printReport(bool $fix): void
    {
        $this->newLine();
        $this->info('=== RECONCILIATION REPORT ===');
        $this->newLine();

        $this->info('CENTER INVENTORY');
        $this->info('----------------');
        $this->info("Checked: {$this->centerChecked} products");
        $this->info('Healthy: '.($this->centerChecked - $this->centerDrifted));
        $this->line("Drifted: <comment>{$this->centerDrifted}</comment>");
        $this->newLine();

        $this->info('OUTLET INVENTORY');
        $this->info('----------------');
        $this->info("Checked: {$this->outletChecked} inventories");
        $this->info('Healthy: '.($this->outletChecked - $this->outletDrifted));
        $this->line("Drifted: <comment>{$this->outletDrifted}</comment>");
        $this->newLine();

        if (! empty($this->drifts)) {
            $this->warn('DRIFT DETECTED');
            $this->warn('--------------');

            foreach ($this->drifts as $d) {
                $this->newLine();
                $this->line("  <comment>{$d['product']}</comment>");
                $this->line("  Location: {$d['location']}");

                if (isset($d['expected_current'])) {
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
                    $this->table(
                        ['Field', 'Expected', 'Actual', 'Drift'],
                        [
                            ['center_stock', $d['expected'], $d['actual'], $d['drift']],
                        ]
                    );
                }
            }
        }

        if (! empty($this->conservationViolations)) {
            $this->newLine();
            $this->error('CONSERVATION VIOLATIONS');
            $this->error('-----------------------');

            foreach ($this->conservationViolations as $cv) {
                $this->newLine();
                $this->line("  <comment>{$cv['product']}</comment>");
                $this->line("  Center: {$cv['center']}  Outlet: {$cv['outlet']}  Total: {$cv['actual_total']}");
                $this->line("  Expected total: {$cv['expected_total']}  Drift: <fg=red>{$cv['drift']}</>");
            }
        }

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
