<?php

namespace Database\Factories;

use App\Models\OutletInventory;
use Illuminate\Database\Eloquent\Factories\Factory;

class OutletInventoryFactory extends Factory
{
    protected $model = OutletInventory::class;

    public function definition(): array
    {
        return [
            'current_stock' => $this->faker->numberBetween(0, 100),
            'reserved_stock' => 0,
            'minimum_stock' => 0,
            'is_active' => true,
        ];
    }
}