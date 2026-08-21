<?php

namespace Database\Seeders;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class OutletInventorySeeder extends Seeder
{
    private const STOCK_MAP = [
        '250ml' => ['current' => 20, 'minimum' => 5],
        '1L' => ['current' => 10, 'minimum' => 3],
    ];

    public function run(): void
    {
        $owner = User::where('role', 'owner')->first();
        $outlets = Outlet::where('status', 'active')->get();
        $products = Product::where('is_active', true)->get();

        if ($outlets->isEmpty()) {
            $this->command->warn('OutletInventorySeeder: No active outlets found — skipping.');

            return;
        }

        if ($products->isEmpty()) {
            $this->command->warn('OutletInventorySeeder: No active products found — skipping.');

            return;
        }

        foreach ($outlets as $outlet) {
            foreach ($products as $product) {
                $stockConfig = self::STOCK_MAP[$product->size] ?? ['current' => 15, 'minimum' => 4];

                $inventory = OutletInventory::updateOrCreate(
                    [
                        'outlet_id' => $outlet->id,
                        'product_id' => $product->id,
                    ],
                    [
                        'current_stock' => $stockConfig['current'],
                        'reserved_stock' => 0,
                        'minimum_stock' => $stockConfig['minimum'],
                    ]
                );

                $hasMovement = StockMovement::where('outlet_id', $outlet->id)
                    ->where('product_id', $product->id)
                    ->where('type', 'initial_stock')
                    ->exists();

                if (! $hasMovement) {
                    StockMovement::create([
                        'outlet_id' => $outlet->id,
                        'product_id' => $product->id,
                        'type' => 'initial_stock',
                        'quantity' => $stockConfig['current'],
                        'before_stock' => 0,
                        'after_stock' => $stockConfig['current'],
                        'before_reserved' => 0,
                        'after_reserved' => 0,
                        'notes' => 'Stok awal untuk '.$product->full_display_name,
                        'created_by' => $owner?->id,
                    ]);
                }
            }
        }
    }
}
