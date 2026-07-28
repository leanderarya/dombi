<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'product_category_id' => ProductCategory::factory(),
            'name' => $this->faker->randomElement(['Original 1L', 'Chocolate 1L', 'Coffee 200ml']),
            'description' => $this->faker->sentence(),
            'flavor' => $this->faker->randomElement(['Original', 'Chocolate', 'Coffee', 'Strawberry', 'Vanilla']),
            'size' => $this->faker->randomElement(['1L', '500ml', '200ml']),
            'sku' => 'SKU-'.$this->faker->unique()->numerify('###'),
            'center_price' => 30000,
            'selling_price' => 40000,
            'center_stock' => 0,
            'is_active' => true,
        ];
    }
}
