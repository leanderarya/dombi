<?php

namespace Database\Factories;

use App\Models\Outlet;
use App\Models\Settlement;
use Illuminate\Database\Eloquent\Factories\Factory;

class SettlementFactory extends Factory
{
    protected $model = Settlement::class;

    public function definition(): array
    {
        return [
            'outlet_id' => Outlet::factory(),
            'period_date' => now()->subDays(7)->toDateString(),
            'sales_amount' => $this->faker->randomFloat(2, 100000, 1000000),
            'amount_due' => $this->faker->randomFloat(2, 50000, 500000),
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_PENDING,
            'paid_amount' => 0,
        ];
    }
}
