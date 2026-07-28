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
            'name' => $this->faker->unique()->word().' '.$this->faker->randomElement(['Milk', 'Goat', 'Premium']),
            'brand' => 'Dombi',
            'description' => $this->faker->sentence(),
            'is_active' => true,
        ];
    }
}
