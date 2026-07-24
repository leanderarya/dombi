<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\RefundStatusHistory;
use Illuminate\Database\Eloquent\Factories\Factory;

class RefundStatusHistoryFactory extends Factory
{
    protected $model = RefundStatusHistory::class;

    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'from_status' => $this->faker->randomElement(['pending', 'processing', null]),
            'to_status' => 'refunded',
            'event' => $this->faker->randomElement([
                RefundStatusHistory::EVENT_REFUND_REQUESTED,
                RefundStatusHistory::EVENT_REFUND_COMPLETED,
            ]),
            'actor_type' => 'system',
            'actor_id' => null,
            'reason_code' => null,
            'note' => null,
            'metadata' => null,
        ];
    }
}
