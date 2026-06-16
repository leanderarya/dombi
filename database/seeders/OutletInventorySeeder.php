<?php

namespace Database\Seeders;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class OutletInventorySeeder extends Seeder
{
    /**
     * Realistic stock quantities per variant size.
     * 250ml variants get higher counts (lower unit cost, higher turnover).
     * 1L variants get lower counts (higher unit cost, slower turnover).
     */
    private const STOCK_MAP = [
        '250ml' => ['current' => 20, 'minimum' => 5],
        '1L' => ['current' => 10, 'minimum' => 3],
    ];

    public function run(): void
    {
        $owner = User::where('role', 'owner')->first();
        $outlets = Outlet::where('status', 'active')->get();
        $variants = ProductVariant::where('is_active', true)->get();

        if ($outlets->isEmpty()) {
            $this->command->warn('OutletInventorySeeder: No active outlets found — skipping.');

            return;
        }

        if ($variants->isEmpty()) {
            $this->command->warn('OutletInventorySeeder: No active variants found — skipping.');

            return;
        }

        foreach ($outlets as $outlet) {
            foreach ($variants as $variant) {
                $stockConfig = self::STOCK_MAP[$variant->size] ?? ['current' => 15, 'minimum' => 4];

                $inventory = OutletInventory::updateOrCreate(
                    [
                        'outlet_id' => $outlet->id,
                        'product_variant_id' => $variant->id,
                    ],
                    [
                        'product_id' => $variant->product_id,
                        'current_stock' => $stockConfig['current'],
                        'reserved_stock' => 0,
                        'minimum_stock' => $stockConfig['minimum'],
                    ]
                );

                // Create initial stock movement if none exists for this variant
                $hasMovement = StockMovement::where('outlet_id', $outlet->id)
                    ->where('product_variant_id', $variant->id)
                    ->where('type', 'initial_stock')
                    ->exists();

                if (! $hasMovement) {
                    StockMovement::create([
                        'outlet_id' => $outlet->id,
                        'product_id' => $variant->product_id,
                        'product_variant_id' => $variant->id,
                        'type' => 'initial_stock',
                        'quantity' => $stockConfig['current'],
                        'before_stock' => 0,
                        'after_stock' => $stockConfig['current'],
                        'before_reserved' => 0,
                        'after_reserved' => 0,
                        'notes' => 'Stok awal untuk '.$variant->full_name,
                        'created_by' => $owner?->id,
                    ]);
                }
            }
        }
    }
}
