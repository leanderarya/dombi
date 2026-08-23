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
