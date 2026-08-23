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

    public function test_fresh_initiated_attempt_is_claimed_and_created(): void
    {
        Http::fake(['*' => Http::response(['response' => ['payment' => ['url' => 'https://pay.test/init']]], 200)]);
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

        $this->assertSame('https://pay.test/init', app(DokuService::class)->createPayment($attempt));
        $this->assertDatabaseHas('payment_attempts', ['id' => $attempt->id, 'creation_state' => 'created']);
    }

    public function test_stale_creation_response_becomes_unknown_without_persisting_payment(): void
    {
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'stale', 'invoice_number' => 'INV-STALE', 'merchant_request_id' => 'REQ-STALE', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Initiated]);
        Http::fake(function () use ($attempt) {
            $attempt->update(['metadata' => ['creation_lease' => ['token' => 'different', 'expires_at' => now()->addMinute()->toIso8601String()]]]);

            return Http::response(['response' => ['payment' => ['url' => 'https://pay.test/stale']]], 200);
        });

        $this->expectException(DokuPaymentException::class);
        app(DokuService::class)->createPayment($attempt);
        $this->assertDatabaseHas('payment_attempts', ['id' => $attempt->id, 'creation_state' => 'unknown']);
        $this->assertDatabaseMissing('payment_transactions', ['doku_order_id' => 'INV-STALE']);
    }

    public function test_stale_creation_failure_cannot_change_attempt_state(): void
    {
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'stale-failure', 'invoice_number' => 'INV-STALE-FAILURE', 'merchant_request_id' => 'REQ-STALE-FAILURE', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Initiated]);
        Http::fake(function () use ($attempt) {
            $attempt->update(['metadata' => ['creation_lease' => ['token' => 'other', 'expires_at' => now()->addMinute()->toIso8601String()]]]);

            return Http::response(['error_messages' => ['rejected']], 400);
        });

        $this->expectException(DokuPaymentException::class);
        try {
            app(DokuService::class)->createPayment($attempt);
        } finally {
            $this->assertDatabaseHas('payment_attempts', ['id' => $attempt->id, 'creation_state' => 'initiated']);
        }
    }

    public function test_pending_attempt_with_url_is_reused_without_provider_call(): void
    {
        Http::fake();
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-pending',
            'invoice_number' => 'INV-PENDING',
            'merchant_request_id' => 'REQ-PENDING',
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'creation_state' => PaymentAttemptCreationState::Created,
            'metadata' => ['payment_url' => 'https://pay.test/pending'],
        ]);
        $attempt->update(['creation_state' => 'created']);

        $this->assertSame('https://pay.test/pending', app(DokuService::class)->createPayment($attempt));
        Http::assertNothingSent();
    }

    public function test_pending_attempt_without_url_is_blocked(): void
    {
        Http::fake();
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-pending-no-url',
            'invoice_number' => 'INV-PENDING-NO-URL',
            'merchant_request_id' => 'REQ-PENDING-NO-URL',
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'creation_state' => PaymentAttemptCreationState::Created,
        ]);

        $this->expectException(DokuPaymentException::class);
        app(DokuService::class)->createPayment($attempt);
        Http::assertNothingSent();
    }

    public function test_unknown_attempt_is_reused_without_provider_call(): void
    {
        Http::fake();
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-unknown',
            'invoice_number' => 'INV-UNKNOWN',
            'merchant_request_id' => 'REQ-UNKNOWN',
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'creation_state' => PaymentAttemptCreationState::Unknown,
        ]);

        $this->expectException(DokuPaymentException::class);
        app(DokuService::class)->createPayment($attempt);
        Http::assertNothingSent();
    }

    public function test_claimed_initiated_attempt_blocks_second_creator(): void
    {
        Http::fake();
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-claimed',
            'invoice_number' => 'INV-CLAIMED',
            'merchant_request_id' => 'REQ-CLAIMED',
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'creation_state' => PaymentAttemptCreationState::Initiated,
            'metadata' => ['creation_lease' => ['token' => 'other', 'expires_at' => now()->addMinute()->toIso8601String()]],
        ]);

        $this->expectException(DokuPaymentException::class);
        app(DokuService::class)->createPayment($attempt);
        Http::assertNothingSent();
    }

    public function test_created_attempt_is_reused_after_double_click(): void
    {
        Http::fake(['*' => Http::response(['response' => ['payment' => ['url' => 'https://pay.test/once']]], 200)]);
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-double',
            'invoice_number' => 'INV-DOUBLE',
            'merchant_request_id' => 'REQ-DOUBLE',
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'creation_state' => PaymentAttemptCreationState::Initiated,
        ]);

        app(DokuService::class)->createPayment($attempt);
        app(DokuService::class)->createPayment($attempt->fresh());

        Http::assertSentCount(1);
    }
}
