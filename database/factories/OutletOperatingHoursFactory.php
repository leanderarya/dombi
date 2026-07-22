<?php

namespace Database\Factories;

use App\Models\OutletOperatingHours;
use Illuminate\Database\Eloquent\Factories\Factory;

class OutletOperatingHoursFactory extends Factory
{
    protected $model = OutletOperatingHours::class;

    public function definition(): array
    {
        return [
            'outlet_id' => \App\Models\Outlet::factory(),
            'day_of_week' => $this->faker->numberBetween(0, 6),
            'open_time' => '08:00',
            'close_time' => '20:00',
            'is_closed' => false,
        ];
    }
}