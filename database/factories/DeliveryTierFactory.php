<?php

namespace Database\Factories;

use App\Models\DeliveryTier;
use Illuminate\Database\Eloquent\Factories\Factory;

class DeliveryTierFactory extends Factory
{
    protected $model = DeliveryTier::class;

    public function definition(): array
    {
        return [
            'min_km' => 0,
            'max_km' => $this->faker->randomFloat(2, 1, 20),
            'fee' => $this->faker->numberBetween(3000, 20000),
            'is_active' => true,
            'sort_order' => $this->faker->numberBetween(1, 10),
        ];
    }
}
