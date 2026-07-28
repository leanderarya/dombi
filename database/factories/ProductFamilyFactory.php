<?php

namespace Database\Factories;

use App\Models\ProductFamily;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductFamilyFactory extends Factory
{
    protected $model = ProductFamily::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->unique()->word(),
            'brand' => $this->faker->randomElement(['Dombi', 'Biogoat']),
            'description' => $this->faker->sentence(),
            'image' => null,
            'is_active' => true,
        ];
    }
}
