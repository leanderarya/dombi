<?php

namespace Database\Factories;

use App\Models\ProductCategory;
use App\Models\ProductFlavorGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFlavorGroupFactory extends Factory
{
    protected $model = ProductFlavorGroup::class;

    public function definition(): array
    {
        return [
            'product_category_id' => ProductCategory::factory(),
            'flavor' => $this->faker->unique()->word(),
            'is_active' => true,
        ];
    }
}
