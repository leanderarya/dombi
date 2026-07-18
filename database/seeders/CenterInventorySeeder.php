<?php

namespace Database\Seeders;

use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class CenterInventorySeeder extends Seeder
{
    /**
     * Center stock quantities per variant size.
     * Higher stock for smaller sizes (higher turnover).
     * Lower stock for larger sizes (higher unit cost).
     */
    private const STOCK_MAP = [
        '250ml' => 50,
        '500ml' => 30,
        '1L' => 20,
    ];

    public function run(): void
    {
        $owner = User::where('role', 'owner')->first();
        $variants = ProductVariant::where('is_active', true)->get();

        if ($variants->isEmpty()) {
            $this->command->warn('CenterInventorySeeder: No active variants found — skipping.');

            return;
        }

        foreach ($variants as $variant) {
            $stock = self::STOCK_MAP[$variant->size] ?? 25;

            $variant->update([
                'center_stock' => $stock,
            ]);

            // Create initial_stock movement for center if none exists — needed for reconcile baseline
            $hasMovement = StockMovement::whereNull('outlet_id')
                ->where('product_variant_id', $variant->id)
                ->where('type', 'initial_stock')
                ->exists();

            if (! $hasMovement) {
                StockMovement::create([
                    'outlet_id' => null,
                    'product_variant_id' => $variant->id,
                    'type' => 'initial_stock',
                    'quantity' => $stock,
                    'before_stock' => 0,
                    'after_stock' => $stock,
                    'before_reserved' => 0,
                    'after_reserved' => 0,
                    'notes' => 'Stok awal pusat untuk '.$variant->full_name,
                    'created_by' => $owner?->id,
                ]);
            }
        }

        $this->command->info("CenterInventorySeeder: Updated center_stock for {$variants->count()} variants.");
    }
}
