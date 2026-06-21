<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create product catalog (families + variants)
        $this->call(ProductCatalogSeeder::class);

        // 2. Create users (owner, outlets, courier) and outlet data
        $this->call(OutletSeeder::class);

        // 3. Seed center inventory for all active variants
        $this->call(CenterInventorySeeder::class);

        // 4. Seed outlet inventory for all active variants
        $this->call(OutletInventorySeeder::class);
    }
}
