<?php

namespace App\Console\Commands;

use App\Models\OutletInventory;
use App\Models\StockMovement;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class InventoryReconcile extends Command
{
    protected $signature = 'inventory:reconcile
        {--fix : Apply corrections to mismatched inventory}
        {--outlet= : Only check specific outlet ID}';

    protected $description = 'Reconcile inventory by comparing stored values against StockMovement history';

    public function handle(): int
    {
        $fix = $this->option('fix');
        $outletFilter = $this->option('outlet') ? (int) $this->option('outlet') : null;

        $query = OutletInventory::query();
        if ($outletFilter) {
            $query->where('outlet_id', $outletFilter);
        }

        $inventories = $query->get();
        $mismatches = 0;
        $fixed = 0;

        $this->info("Checking {$inventories->count()} inventory records...");

        $bar = $this->output->createProgressBar($inventories->count());
        $bar->start();

        foreach ($inventories as $inventory) {
            $bar->advance();

            // Compute current_stock from movements
            $computedCurrent = $this->computeCurrentStock($inventory->outlet_id, $inventory->product_id);

            // Compute reserved_stock from active orders
            $computedReserved = $this->computeReservedStock($inventory->outlet_id, $inventory->product_id);

            $currentDrift = $inventory->current_stock - $computedCurrent;
            $reservedDrift = $inventory->reserved_stock - $computedReserved;

            if ($currentDrift !== 0 || $reservedDrift !== 0) {
                $mismatches++;

                $this->newLine();
                $this->warn("  Mismatch: outlet={$inventory->outlet_id} product={$inventory->product_id}");
                $this->table(
                    ['Field', 'Stored', 'Computed', 'Drift'],
                    [
                        ['current_stock', $inventory->current_stock, $computedCurrent, $currentDrift],
                        ['reserved_stock', $inventory->reserved_stock, $computedReserved, $reservedDrift],
                    ]
                );

                if ($fix) {
                    DB::transaction(function () use ($inventory, $computedCurrent, $computedReserved) {
                        $inventory = OutletInventory::query()->lockForUpdate()->findOrFail($inventory->id);

                        $beforeCurrent = $inventory->current_stock;
                        $beforeReserved = $inventory->reserved_stock;

                        $inventory->update([
                            'current_stock' => $computedCurrent,
                            'reserved_stock' => $computedReserved,
                        ]);

                        StockMovement::create([
                            'outlet_id' => $inventory->outlet_id,
                            'product_id' => $inventory->product_id,
                            'type' => 'stock_adjustment',
                            'quantity' => $computedCurrent - $beforeCurrent,
                            'before_stock' => $beforeCurrent,
                            'after_stock' => $computedCurrent,
                            'before_reserved' => $beforeReserved,
                            'after_reserved' => $computedReserved,
                            'notes' => 'Inventory reconciliation correction',
                            'created_by' => null,
                        ]);
                    });

                    $this->line("  <info>FIXED</info>");
                    $fixed++;
                }
            }
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("Results: {$mismatches} mismatches found" . ($fix ? ", {$fixed} fixed" : ''));

        if ($mismatches > 0 && ! $fix) {
            $this->warn("Run with --fix to apply corrections.");
        }

        return self::SUCCESS;
    }

    private function computeCurrentStock(int $outletId, int $productId): int
    {
        $movements = StockMovement::query()
            ->where('outlet_id', $outletId)
            ->where('product_id', $productId)
            ->orderBy('id')
            ->get();

        $stock = 0;
        foreach ($movements as $movement) {
            $stock += $movement->quantity;
        }

        return max(0, $stock);
    }

    private function computeReservedStock(int $outletId, int $productId): int
    {
        // Reserved = sum of active order items for this outlet/product
        return DB::table('order_items')
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
}
