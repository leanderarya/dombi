<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;

class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        return [
            'customer_id' => fn () => Customer::create([
                'name' => fake()->name(),
                'phone' => '0812'.fake()->unique()->numerify('########'),
            ])->id,
            'outlet_id' => null,
            'order_code' => 'ORD-'.strtoupper($this->faker->unique()->bothify('??####')),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => Order::FULFILLMENT_PICKUP,
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => $this->faker->name(),
            'customer_phone' => '0812'.$this->faker->numerify('########'),
            'customer_address' => $this->faker->address(),
            'payment_status' => 'pending',
            'ordered_at' => now(),
        ];
    }

    public function paid(): static
    {
        return $this->state(fn () => [
            'payment_status' => 'paid',
            'paid_at' => now(),
        ]);
    }

    public function pending(): static
    {
        return $this->state(fn () => [
            'payment_status' => 'pending',
        ]);
    }
}
