<?php

namespace Database\Factories;

use App\Models\ProductCategory;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'product_category_id' => ProductCategory::factory(),
            'name' => 'Original ' . $this->faker->randomElement(['1L', '500ml', '200ml']),
            'description' => $this->faker->sentence(),
            'flavor' => $this->faker->randomElement(['Original', 'Chocolate', 'Coffee']),
            'size' => $this->faker->randomElement(['1L', '500ml', '200ml']),
            'sku' => 'SKU-' . $this->faker->unique()->numerify('####'),
            'center_price' => 30000,
            'selling_price' => 40000,
            'center_stock' => $this->faker->numberBetween(0, 100),
            'image' => null,
            'is_active' => true,
        ];
    }
}
