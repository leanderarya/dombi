<?php

namespace Database\Seeders;

use App\Models\DeliveryTier;
use Illuminate\Database\Seeder;

class DeliveryTierSeeder extends Seeder
{
    public function run(): void
    {
        $tiers = [
            ['min_km' => 0, 'max_km' => 3,  'fee' => 5000,  'sort_order' => 1],
            ['min_km' => 3, 'max_km' => 5,  'fee' => 8000,  'sort_order' => 2],
            ['min_km' => 5, 'max_km' => 8,  'fee' => 12000, 'sort_order' => 3],
            ['min_km' => 8, 'max_km' => 10, 'fee' => 15000, 'sort_order' => 4],
        ];

        foreach ($tiers as $tier) {
            DeliveryTier::updateOrCreate(
                ['max_km' => $tier['max_km']],
                $tier,
            );
        }
    }
}
