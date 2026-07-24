<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerRefundExperienceTest extends TestCase
{
    use RefreshDatabase;

    public function test_detail_returns_ok(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $response = $this->actingAs($user)->get("/customer/orders/{$order->id}");

        $response->assertOk();
    }

    public function test_refund_failed_shows_detail(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_failed',
            'refund_amount' => 50000,
        ]);

        $response = $this->actingAs($user)->get("/customer/orders/{$order->id}");

        $response->assertOk();
    }
}
