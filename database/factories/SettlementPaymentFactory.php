<?php

namespace Database\Factories;

use App\Models\Outlet;
use App\Models\SettlementPayment;
use Illuminate\Database\Eloquent\Factories\Factory;

class SettlementPaymentFactory extends Factory
{
    protected $model = SettlementPayment::class;

    public function definition(): array
    {
        return [
            'outlet_id' => Outlet::factory(),
            'reference_number' => 'PAY-'.$this->faker->unique()->numerify('######'),
            'payment_date' => now()->toDateString(),
            'amount' => $this->faker->randomFloat(2, 50000, 500000),
            'status' => SettlementPayment::STATUS_PENDING,
        ];
    }
}
