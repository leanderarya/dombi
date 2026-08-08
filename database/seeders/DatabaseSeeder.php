<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Product catalog (families + variants)
        $this->call(ProductCatalogSeeder::class);

        // 2. Users (owner, outlets, courier) + outlet data
        $this->call(OutletSeeder::class);

        // 3. Delivery pricing tiers
        $this->call(DeliveryTierSeeder::class);

        // 4. Center inventory
        $this->call(CenterInventorySeeder::class);

        // 5. Outlet inventory + stock movements
        $this->call(OutletInventorySeeder::class);

        // 6. Payment accounts for settlement
        $this->call(PaymentAccountSeeder::class);

        // 7. Customers (registered + guest) + addresses
        $this->call(CustomerSeeder::class);

        // 8. Demo orders (registered + guest) — whole-system testing
        $this->call(DemoOrderSeeder::class);
    }
}
