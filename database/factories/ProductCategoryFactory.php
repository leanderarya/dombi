<?php

namespace Database\Factories;

use App\Models\ProductCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductCategoryFactory extends Factory
{
    protected $model = ProductCategory::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->unique()->word() . ' ' . $this->faker->randomElement(['Goat', 'Milk', 'Dombi']),
            'brand' => $this->faker->randomElement(['Dombi', 'Biogoat', 'Domilk']),
            'description' => $this->faker->sentence(),
            'image' => null,
            'is_active' => true,
        ];
    }
}
