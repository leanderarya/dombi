<?php

namespace Database\Seeders;

use App\Models\ProductVariant;
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
        }

        $this->command->info("CenterInventorySeeder: Updated center_stock for {$variants->count()} variants.");
    }
}
