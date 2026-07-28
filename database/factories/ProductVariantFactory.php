<?php

namespace Database\Factories;

use App\Models\ProductFamily;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductVariantFactory extends Factory
{
    protected $model = ProductVariant::class;

    public function definition(): array
    {
        return [
            'product_family_id' => ProductFamily::factory(),
            'name' => 'Original '.$this->faker->randomElement(['1L', '500ml', '200ml']),
            'flavor' => $this->faker->randomElement(['Original', 'Chocolate', 'Coffee']),
            'size' => $this->faker->randomElement(['1L', '500ml', '200ml']),
            'sku' => 'SKU-'.$this->faker->unique()->numerify('###'),
            'center_price' => 30000,
            'selling_price' => 40000,
            'center_stock' => 0,
            'is_active' => true,
        ];
    }
}
