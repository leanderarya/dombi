<?php

namespace Database\Factories;

use App\Models\Outlet;
use Illuminate\Database\Eloquent\Factories\Factory;

class OutletFactory extends Factory
{
    protected $model = Outlet::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->company(),
            'kelurahan' => $this->faker->citySuffix(),
            'kecamatan' => $this->faker->citySuffix(),
            'address' => $this->faker->streetAddress(),
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ];
    }
}
