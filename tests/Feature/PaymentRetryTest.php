<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptCreationState;
use App\Exceptions\DokuPaymentException;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentRetryTest extends TestCase
{
    use RefreshDatabase;

    public function test_failed_unknown_attempt_requires_reconciliation_before_creation(): void
    {
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'failed-unknown', 'invoice_number' => 'failed-unknown', 'merchant_request_id' => 'failed-unknown-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => 'failed', 'settlement_status' => 'unknown']);
        Http::fake();

        $this->expectException(DokuPaymentException::class);
        app(DokuService::class)->createPayment($attempt);
        Http::assertNothingSent();
    }

    public function test_retry_creates_fresh_identity_and_preserves_failed_attempt(): void
    {
        $order = Order::factory()->create();
        $old = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'old', 'invoice_number' => 'old-invoice', 'merchant_request_id' => 'old-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Failed, 'settlement_status' => 'failed']);
        $service = app(DokuService::class);

        $new = $service->preparePaymentAttempt($order);

        $this->assertNotSame($old->invoice_number, $new->invoice_number);
        $this->assertDatabaseHas('payment_attempts', ['id' => $old->id, 'creation_state' => 'failed']);
        $this->assertDatabaseCount('payment_attempts', 2);
    }

    public function test_successful_reconciliation_settles_attempt_and_order(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'reconcile-success', 'invoice_number' => 'reconcile-success-invoice', 'merchant_request_id' => 'reconcile-success-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Unknown]);
        Http::fake(['*/checkout/v1/payment/reconcile-success-invoice' => Http::response(['order' => ['invoice_number' => $attempt->invoice_number], 'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total]], 200)]);

        app(DokuService::class)->reconcilePaymentAttempt($attempt);

        $this->assertDatabaseHas('payment_attempts', ['id' => $attempt->id, 'creation_state' => 'created', 'settlement_status' => 'paid']);
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertNotNull($order->fresh()->paid_at);
    }

    public function test_stale_reconciliation_success_cannot_settle_or_clear_current_lease(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'stale-success', 'invoice_number' => 'stale-success', 'merchant_request_id' => 'stale-success-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Unknown]);
        Http::fake(function () use ($attempt) {
            $attempt->update(['metadata' => ['reconciliation_lease' => ['token' => 'other-worker', 'expires_at' => now()->addMinute()->toIso8601String()]]]);

            return Http::response(['order' => ['invoice_number' => $attempt->invoice_number], 'transaction' => ['status' => 'SUCCESS', 'amount' => $attempt->amount_snapshot]], 200);
        });

        app(DokuService::class)->reconcilePaymentAttempt($attempt);

        $fresh = $attempt->fresh();
        $this->assertSame(PaymentAttemptCreationState::Unknown, $fresh->creation_state);
        $this->assertSame('pending', $fresh->settlement_status?->value);
        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertSame('other-worker', data_get($fresh->metadata, 'reconciliation_lease.token'));
    }

    public function test_stale_reconciliation_response_cannot_change_attempt(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'stale-reconcile', 'invoice_number' => 'stale-reconcile', 'merchant_request_id' => 'stale-reconcile-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Unknown]);
        Http::fake(function () use ($attempt) {
            $attempt->update(['metadata' => ['reconciliation_lease' => ['token' => 'other-worker', 'expires_at' => now()->addMinute()->toIso8601String()]]]);

            return Http::response(['order' => ['invoice_number' => $attempt->invoice_number], 'transaction' => ['status' => 'SUCCESS', 'amount' => $attempt->amount_snapshot]], 200);
        });

        app(DokuService::class)->reconcilePaymentAttempt($attempt);

        $fresh = $attempt->fresh();
        $this->assertSame(PaymentAttemptCreationState::Unknown, $fresh->creation_state);
        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertSame('pending', $fresh->settlement_status?->value);
    }

    public function test_pending_reconciliation_persists_pending_creation_and_settlement(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'pending-reconcile', 'invoice_number' => 'pending-reconcile', 'merchant_request_id' => 'pending-reconcile-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Unknown]);
        Http::fake(['*/checkout/v1/payment/pending-reconcile' => Http::response(['order' => ['invoice_number' => $attempt->invoice_number], 'transaction' => ['status' => 'PENDING']], 200)]);

        app(DokuService::class)->reconcilePaymentAttempt($attempt);

        $fresh = $attempt->fresh();
        $this->assertSame('pending', $fresh->creation_state?->value);
        $this->assertSame('pending', $fresh->settlement_status?->value);
        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertNull(data_get($fresh->metadata, 'reconciliation_lease'));
    }

    public function test_unrecognized_success_status_clears_lease_and_records_recovery_state(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'unknown-status', 'invoice_number' => 'unknown-status', 'merchant_request_id' => 'unknown-status-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Unknown]);
        Http::fake(['*/checkout/v1/payment/unknown-status' => Http::response(['order' => ['invoice_number' => $attempt->invoice_number], 'transaction' => ['status' => 'PROCESSING']], 200)]);

        app(DokuService::class)->reconcilePaymentAttempt($attempt);

        $metadata = $attempt->fresh()->metadata;
        $this->assertSame('unknown', $attempt->fresh()->creation_state?->value);
        $this->assertSame('PROCESSING', $metadata['last_reconciliation_status']);
        $this->assertSame('unrecognized_provider_status', $metadata['last_reconciliation_error']);
        $this->assertNotNull($metadata['next_reconciliation_at']);
        $this->assertNull($metadata['reconciliation_lease']);
    }

    public function test_reconciliation_lease_blocks_concurrent_provider_request(): void
    {
        Http::fake();
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'reconcile-lease', 'invoice_number' => 'reconcile-lease', 'merchant_request_id' => 'reconcile-lease-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Unknown, 'metadata' => ['reconciliation_lease' => ['token' => 'worker-1', 'expires_at' => now()->addMinute()->toIso8601String()]]]);

        app(DokuService::class)->reconcilePaymentAttempt($attempt);

        Http::assertNothingSent();
        $this->assertDatabaseHas('payment_attempts', ['id' => $attempt->id, 'creation_state' => 'unknown']);
    }

    public function test_reconciliation_failure_persists_bounded_backoff_state(): void
    {
        Http::fake(['*/checkout/v1/payment/reconcile-failure' => Http::response('', 503)]);
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'reconcile-failure', 'invoice_number' => 'reconcile-failure', 'merchant_request_id' => 'reconcile-failure-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Unknown]);

        $result = app(DokuService::class)->reconcilePaymentAttempt($attempt);

        $this->assertSame(PaymentAttemptCreationState::Unknown, $result->creation_state);
        $metadata = $result->fresh()->metadata;
        $this->assertSame(1, $metadata['reconciliation_attempts']);
        $this->assertSame(503, $metadata['last_reconciliation_status']);
        $this->assertNotNull($metadata['last_reconciliation_error']);
        $this->assertNotNull($metadata['next_reconciliation_at']);
        $this->assertLessThanOrEqual(5, $metadata['reconciliation_attempts']);
    }

    public function test_ambiguous_5xx_marks_attempt_unknown(): void
    {
        Http::fake(['*' => Http::response('', 504)]);
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'timeout', 'invoice_number' => 'timeout-invoice', 'merchant_request_id' => 'timeout-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Initiated]);

        $this->expectException(DokuPaymentException::class);
        try {
            app(DokuService::class)->createPayment($attempt);
        } finally {
            $this->assertDatabaseHas('payment_attempts', ['id' => $attempt->id, 'creation_state' => 'unknown']);
        }
    }

    public function test_timeout_after_provider_acceptance_marks_attempt_unknown(): void
    {
        Http::fake(['*' => Http::response(['response' => ['order' => ['session_id' => 'accepted']]], 200)]);
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'accepted', 'invoice_number' => 'accepted-invoice', 'merchant_request_id' => 'accepted-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Initiated]);

        $this->expectException(DokuPaymentException::class);
        try {
            app(DokuService::class)->createPayment($attempt);
        } finally {
            $this->assertDatabaseHas('payment_attempts', ['id' => $attempt->id, 'creation_state' => 'unknown']);
        }
    }

    public function test_two_retries_preserve_all_attempt_identities(): void
    {
        $order = Order::factory()->create();
        $service = app(DokuService::class);
        $first = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'retry-one', 'invoice_number' => 'retry-one-invoice', 'merchant_request_id' => 'retry-one-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Failed, 'settlement_status' => 'failed']);
        $second = $service->preparePaymentAttempt($order);
        $second->update(['creation_state' => PaymentAttemptCreationState::Failed, 'settlement_status' => 'failed']);
        $third = $service->preparePaymentAttempt($order);

        PaymentTransaction::create(['order_id' => $order->id, 'doku_order_id' => $first->invoice_number, 'payment_method' => 'qris', 'amount' => $order->total, 'status' => 'failed']);
        PaymentTransaction::create(['order_id' => $order->id, 'doku_order_id' => $second->invoice_number, 'payment_method' => 'qris', 'amount' => $order->total, 'status' => 'failed']);
        $this->assertCount(3, PaymentAttempt::where('order_id', $order->id)->get());
        $this->assertSame(2, PaymentTransaction::where('order_id', $order->id)->count());
        $this->assertDatabaseHas('payment_transactions', ['doku_order_id' => $first->invoice_number]);
        $this->assertDatabaseHas('payment_transactions', ['doku_order_id' => $second->invoice_number]);
        $this->assertNotSame($first->invoice_number, $second->invoice_number);
        $this->assertNotSame($second->invoice_number, $third->invoice_number);
    }

    public function test_definitive_rejection_marks_attempt_failed(): void
    {
        Http::fake(['*' => Http::response(['error_messages' => ['rejected']], 400)]);
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'rejected', 'invoice_number' => 'rejected-invoice', 'merchant_request_id' => 'rejected-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Initiated]);

        $this->expectException(DokuPaymentException::class);
        try {
            app(DokuService::class)->createPayment($attempt);
        } finally {
            $this->assertDatabaseHas('payment_attempts', ['id' => $attempt->id, 'creation_state' => 'failed']);
        }
    }
}
