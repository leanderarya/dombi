<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class OrderPayJsonResponseTest extends TestCase
{
    use RefreshDatabase;

    // Build a minimal order whose payment can be (re)attempted via JSON.
    private function makePayableOrder(): Order
    {
        $customer = Customer::factory()->create(['user_id' => null]);

        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_CONFIRMED,
            'payment_status' => 'pending',
            'confirmation_expires_at' => now()->addMinutes(30),
        ]);

        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => (string) $order->order_code,
            'invoice_number' => (string) $order->order_code,
            'merchant_request_id' => $order->order_code.'-REQ',
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'payment_method' => 'qris',
            'creation_state' => 'initiated',
            'settlement_status' => 'pending',
        ]);

        return $order;
    }

    public function test_json_retry_payment_returns_payment_url_not_redirect(): void
    {
        $order = $this->makePayableOrder();

        $doku = Mockery::mock(DokuService::class);
        $doku->shouldReceive('createPayment')->andReturn('https://sandbox.doku.com/checkout/link/ABC123');

        $this->app->instance(DokuService::class, $doku);

        $this->withSession(['guest_recovery' => [
            'customer_id' => $order->customer_id,
            'order_ids' => [$order->id],
        ]])->postJson("/customer/orders/{$order->id}/pay", [
            'payment_method' => 'qris',
        ])->assertOk()->assertJson([
            'payment_url' => 'https://sandbox.doku.com/checkout/link/ABC123',
        ]);
    }
}
