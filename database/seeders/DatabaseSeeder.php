<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create product catalog (families + variants) — must run first
        $this->call(ProductCatalogSeeder::class);

        // 2. Create demo users, outlets, orders — must run before inventory seeder
        $this->call(DemoSeeder::class);

        // 3. Seed outlet inventory for all active variants — depends on catalog + outlets
        $this->call(OutletInventorySeeder::class);
    }
}
