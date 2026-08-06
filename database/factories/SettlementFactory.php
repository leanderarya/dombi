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
        $amountDue = $this->faker->randomFloat(2, 50000, 500000);

        return [
            'outlet_id' => Outlet::factory(),
            'period_date' => now()->subDays(7)->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->subDays(1)->toDateString(),
            'period_type' => 'weekly',
            'sales_amount' => $this->faker->randomFloat(2, 100000, 1000000),
            'amount_due' => $amountDue,
            'net_amount' => -1 * $amountDue,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
        ];
    }
}
