<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptCreationState;
use App\Exceptions\DokuPaymentException;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentCreationIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_attempt_is_reused_without_second_provider_call(): void
    {
        Http::fake([
            'api-sandbox.doku.com/*' => Http::response(['response' => ['payment' => ['url' => 'https://pay.test/one']]], 200),
        ]);
        config(['doku.base_url' => 'https://api-sandbox.doku.com']);
        $order = Order::factory()->create(['payment_status' => null]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-1',
            'invoice_number' => 'INV-1',
            'merchant_request_id' => 'REQ-1',
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'creation_state' => PaymentAttemptCreationState::Created,
            'metadata' => ['payment_url' => 'https://pay.test/one'],
        ]);

        $url = app(DokuService::class)->createPayment($attempt);

        $this->assertSame('https://pay.test/one', $url);
        Http::assertNothingSent();
        $this->assertDatabaseCount('payment_attempts', 1);
    }

    public function test_initiated_attempt_is_not_duplicated(): void
    {
        Http::fake();
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-initiated',
            'invoice_number' => 'INV-INIT',
            'merchant_request_id' => 'REQ-INIT',
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'creation_state' => PaymentAttemptCreationState::Initiated,
        ]);

        $this->expectException(DokuPaymentException::class);
        app(DokuService::class)->createPayment($attempt);

        Http::assertNothingSent();
        $this->assertDatabaseCount('payment_attempts', 1);
    }
}
