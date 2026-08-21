<?php

namespace Database\Factories;

use App\Models\Outlet;
use App\Models\OutletProductPrice;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

class OutletProductPriceFactory extends Factory
{
    protected $model = OutletProductPrice::class;

    public function definition(): array
    {
        return [
            'outlet_id' => Outlet::factory(),
            'product_id' => Product::factory(),
            'selling_price' => 45000,
        ];
    }
}
