<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class CenterInventorySeeder extends Seeder
{
    private const STOCK_MAP = [
        '250ml' => 50,
        '500ml' => 30,
        '1L' => 20,
    ];

    public function run(): void
    {
        $owner = User::where('role', 'owner')->first();
        $products = Product::where('is_active', true)->get();

        if ($products->isEmpty()) {
            $this->command->warn('CenterInventorySeeder: No active products found — skipping.');

            return;
        }

        foreach ($products as $product) {
            $stock = self::STOCK_MAP[$product->size] ?? 25;

            $product->update([
                'center_stock' => $stock,
            ]);

            $hasMovement = StockMovement::whereNull('outlet_id')
                ->where('product_id', $product->id)
                ->where('type', 'initial_stock')
                ->exists();

            if (! $hasMovement) {
                StockMovement::create([
                    'outlet_id' => null,
                    'product_id' => $product->id,
                    'type' => 'initial_stock',
                    'quantity' => $stock,
                    'before_stock' => 0,
                    'after_stock' => $stock,
                    'before_reserved' => 0,
                    'after_reserved' => 0,
                    'notes' => 'Stok awal pusat untuk '.$product->full_display_name,
                    'created_by' => $owner?->id,
                ]);
            }
        }

        $this->command->info("CenterInventorySeeder: Updated center_stock for {$products->count()} products.");
    }
}
