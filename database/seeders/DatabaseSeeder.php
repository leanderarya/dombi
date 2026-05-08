<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\CustomerAddress;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\StockMovement;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $owner = User::updateOrCreate(
            ['email' => 'owner@example.com'],
            ['name' => 'Owner Dombi', 'password' => Hash::make('password'), 'role' => 'owner', 'phone' => '081111111111', 'is_active' => true]
        );

        $customer = User::updateOrCreate(
            ['email' => 'customer@example.com'],
            ['name' => 'Customer Dombi', 'password' => Hash::make('password'), 'role' => 'customer', 'phone' => '082222222222', 'is_active' => true]
        );

        User::updateOrCreate(
            ['email' => 'outlet@example.com'],
            ['name' => 'Outlet Dombi', 'password' => Hash::make('password'), 'role' => 'outlet', 'phone' => '083333333333', 'is_active' => true]
        );

        User::updateOrCreate(
            ['email' => 'courier@example.com'],
            ['name' => 'Courier Dombi', 'password' => Hash::make('password'), 'role' => 'courier', 'phone' => '084444444444', 'is_active' => true]
        );

        $category = ProductCategory::updateOrCreate(
            ['slug' => 'susu-kambing'],
            ['name' => 'Susu Kambing', 'is_active' => true]
        );

        $product = Product::updateOrCreate(
            ['slug' => 'susu-kambing-500ml'],
            [
                'product_category_id' => $category->id,
                'name' => 'Susu Kambing 500ml',
                'description' => 'Susu kambing segar siap minum.',
                'size' => '500ml',
                'unit' => 'botol',
                'price' => 25000,
                'is_active' => true,
            ]
        );

        $tembalang = Outlet::updateOrCreate(
            ['name' => 'Outlet Tembalang'],
            [
                'kelurahan' => 'Tembalang',
                'kecamatan' => 'Tembalang',
                'address' => 'Jl. Tembalang, Semarang',
                'latitude' => -7.0568000,
                'longitude' => 110.4381000,
                'phone' => '085555555555',
                'status' => 'active',
            ]
        );

        $banyumanik = Outlet::updateOrCreate(
            ['name' => 'Outlet Banyumanik'],
            [
                'kelurahan' => 'Banyumanik',
                'kecamatan' => 'Banyumanik',
                'address' => 'Jl. Banyumanik, Semarang',
                'latitude' => -7.0731000,
                'longitude' => 110.4216000,
                'phone' => '086666666666',
                'status' => 'active',
            ]
        );

        foreach ([[$tembalang, 0], [$banyumanik, 10]] as [$outlet, $stock]) {
            $inventory = OutletInventory::updateOrCreate(
                ['outlet_id' => $outlet->id, 'product_id' => $product->id],
                ['current_stock' => $stock, 'reserved_stock' => 0, 'minimum_stock' => 2]
            );

            StockMovement::updateOrCreate(
                [
                    'outlet_id' => $outlet->id,
                    'product_id' => $product->id,
                    'type' => 'initial_stock',
                ],
                [
                    'quantity' => $stock,
                    'before_stock' => 0,
                    'after_stock' => $inventory->current_stock,
                    'notes' => 'Seeder stok awal',
                    'created_by' => $owner->id,
                ]
            );
        }

        CustomerAddress::updateOrCreate(
            ['user_id' => $customer->id, 'label' => 'Rumah Tembalang'],
            [
                'recipient_name' => 'Customer Dombi',
                'phone' => '082222222222',
                'address' => 'Jl. Sekitar Tembalang, Semarang',
                'kelurahan' => 'Tembalang',
                'kecamatan' => 'Tembalang',
                'latitude' => -7.0559000,
                'longitude' => 110.4375000,
                'is_default' => true,
            ]
        );
    }
}
