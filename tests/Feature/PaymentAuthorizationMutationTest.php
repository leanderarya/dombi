<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PaymentAuthorizationMutationTest extends TestCase
{
    use RefreshDatabase;

    public function test_unrelated_customer_cannot_pay_another_order(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $other = Order::factory()->create();

        $response = $this->actingAs($user)->post("/customer/orders/{$other->id}/pay", [
            'payment_method' => 'qris',
        ]);

        $response->assertStatus(403);
        $this->assertEquals('pending', $other->fresh()->payment_status);
    }

    public function test_guest_without_recovery_cannot_pay(): void
    {
        $order = Order::factory()->create();

        $response = $this->post("/customer/orders/{$order->id}/pay", [
            'payment_method' => 'qris',
        ]);

        $response->assertStatus(403);
        $this->assertEquals('pending', $order->fresh()->payment_status);
    }

    public function test_guest_with_recovery_can_pay(): void
    {
        Queue::fake();
        $customer = Customer::factory()->create(['user_id' => null]);
        $order = Order::factory()->create(['customer_id' => $customer->id]);

        session(['guest_recovery' => [
            'customer_id' => $customer->id,
            'order_ids' => [$order->id],
        ]]);

        Http::fake([
            '*/checkout/v1/payment' => Http::response([
                'response' => [
                    'order' => ['session_id' => 'sess-123'],
                    'payment' => ['url' => 'https://sandbox.doku.com/pay/abc123'],
                ],
            ], 200),
        ]);

        $response = $this->post("/customer/orders/{$order->id}/pay", [
            'payment_method' => 'qris',
        ]);

        $response->assertRedirect();
    }

    public function test_owner_can_pay_any_order(): void
    {
        Queue::fake();
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create();

        Http::fake([
            '*/checkout/v1/payment' => Http::response([
                'response' => [
                    'order' => ['session_id' => 'sess-123'],
                    'payment' => ['url' => 'https://sandbox.doku.com/pay/abc123'],
                ],
            ], 200),
        ]);

        $response = $this->actingAs($owner)->post("/customer/orders/{$order->id}/pay", [
            'payment_method' => 'qris',
        ]);

        $response->assertRedirect();
    }

    public function test_unrelated_customer_cannot_poll_payment_status(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $other = Order::factory()->create();

        $response = $this->actingAs($user)->get("/customer/orders/{$other->id}/payment-status");

        $response->assertStatus(403);
    }

    public function test_guest_without_recovery_cannot_poll_payment_status(): void
    {
        $order = Order::factory()->create();

        $response = $this->get("/customer/orders/{$order->id}/payment-status");

        $response->assertStatus(403);
    }

    public function test_guest_with_recovery_can_poll(): void
    {
        $customer = Customer::factory()->create(['user_id' => null]);
        $order = Order::factory()->create(['customer_id' => $customer->id]);

        session(['guest_recovery' => [
            'customer_id' => $customer->id,
            'order_ids' => [$order->id],
        ]]);

        $response = $this->get("/customer/orders/{$order->id}/payment-status");

        $response->assertOk();
    }
}
