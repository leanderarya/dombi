<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use App\Models\RefundObligation;
use App\Services\DokuService;
use App\Services\NotificationService;
use App\Services\OrderPaymentProjectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentProductionInvariantTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(NotificationService::class, function ($mock) {
            $mock->shouldReceive('notifyOrderCreated')->andReturnNull();
            $mock->shouldReceive('notifyOrderConfirmed')->andReturnNull();
            $mock->shouldReceive('notifyRefundRequested')->andReturnNull();
            $mock->shouldReceive('notifyRefundEvent')->andReturnNull();
        });
    }

    public function test_duplicate_success_notifications_do_not_create_duplicate_paid_attempts(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        $payload = [
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'SUCCESS'],
        ];
        $service = app(DokuService::class);
        $service->handleWebhook($payload);
        $service->handleWebhook($payload);

        $this->assertDatabaseCount('payment_transactions', 1);
        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertSame(0, PaymentAttempt::where('order_id', $order->id)->count());
    }

    public function test_legacy_synthesized_attempt_never_fulfils_from_webhook_success(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total, 'id' => 'provider-1'],
        ]);

        $this->assertSame(0, PaymentAttempt::where('order_id', $order->id)->count());
        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_success_with_amount_mismatch_does_not_settle_order(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending', 'total' => 50000]);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'mismatch-'.$order->id,
            'invoice_number' => $order->order_code, 'merchant_request_id' => 'mismatch-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);
        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'SUCCESS', 'amount' => 10000],
        ]);

        $attempt = PaymentAttempt::where('order_id', $order->id)->sole();
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->settlement_status);
        $this->assertSame(PaymentAttemptVerificationStatus::NeedsReview, $attempt->verification_status);
        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertDatabaseCount('refund_status_histories', 0);
    }

    public function test_order_payment_status_projects_from_successful_attempt_state(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $transaction = PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'projection-'.$order->id,
            'invoice_number' => $order->order_code,
            'merchant_request_id' => 'projection-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Paid,
            'verification_status' => PaymentAttemptVerificationStatus::Verified,
        ]);

        $this->assertSame('paid', app(OrderPaymentProjectionService::class)->recompute($order));
    }

    public function test_duplicate_payment_retry_creation_keeps_single_attempt_for_same_invoice(): void
    {
        $order = Order::factory()->create(['order_code' => 'INV-RETRY', 'payment_status' => 'pending']);
        Http::fake([
            '*/checkout/v1/payment' => Http::response([
                'response' => [
                    'order' => ['session_id' => 'sess-retry'],
                    'payment' => ['url' => 'https://sandbox.doku.com/pay/retry'],
                ],
            ]),
        ]);

        $service = app(DokuService::class);
        $service->createPayment($service->preparePaymentAttempt($order));

        try {
            $service->createPayment($service->preparePaymentAttempt($order->fresh()));
        } catch (\Throwable) {
            $this->fail('Duplicate retry creation must be idempotent, not fail with a database exception.');
        }

        $this->assertSame(0, PaymentTransaction::where('order_id', $order->id)->count());
    }

    public function test_invoice_without_canonical_attempt_cannot_settle_order(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);

        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => 'INV-NO-ATTEMPT'],
            'transaction' => ['status' => 'SUCCESS'],
        ]);

        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertDatabaseMissing('payment_transactions', ['doku_order_id' => 'INV-NO-ATTEMPT']);
    }

    public function test_duplicate_late_success_webhooks_create_one_refund_obligation_for_attempt(): void
    {
        $order = Order::factory()->create([
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => 'pending',
            'total' => 50000,
        ]);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);
        PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'late-'.$order->id,
            'invoice_number' => $order->order_code, 'merchant_request_id' => 'late-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);
        $payload = [
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'SUCCESS', 'amount' => 50000],
        ];
        $service = app(DokuService::class);
        $service->handleWebhook($payload);
        $service->handleWebhook($payload);

        $this->assertSame('paid', $order->fresh()->payment_status);
        $attempt = PaymentAttempt::where('order_id', $order->id)->sole();
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->settlement_status);
        $this->assertNull($attempt->fulfilment_claimed_at);
        $this->assertSame(1, RefundObligation::where('payment_attempt_id', $attempt->id)->where('reason', 'late_payment')->count());
        $this->assertSame(0, PaymentTransaction::where('order_id', $order->id)->where('status', 'paid')->count());
    }

    public function test_duplicate_refund_request_returns_null_without_second_obligation(): void
    {
        $order = Order::factory()->paid()->create(['total' => 50000]);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'REFUND-'.$order->id,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'paid',
        ]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'refund-'.$order->id,
            'invoice_number' => 'REFUND-'.$order->id,
            'merchant_request_id' => 'refund-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Paid,
            'verification_status' => PaymentAttemptVerificationStatus::Verified,
        ]);
        RefundObligation::create([
            'payment_attempt_id' => $attempt->id,
            'amount' => $order->total,
            'currency' => 'IDR',
            'reason' => 'late_payment',
        ]);
        $this->assertSame(1, RefundObligation::where('payment_attempt_id', $attempt->id)->where('reason', 'late_payment')->count());
    }

    public function test_manual_paid_without_authoritative_amount_requires_review_and_cannot_fulfil(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'manual-'.$order->id,
            'invoice_number' => $order->order_code,
            'merchant_request_id' => 'manual-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
        ]);

        app(DokuService::class)->markOrderPaid($attempt);

        $attempt = $attempt->fresh();
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->settlement_status);
        $this->assertSame(PaymentAttemptVerificationStatus::NeedsReview, $attempt->verification_status);
        $this->assertNull($attempt->fulfilment_claimed_at);
        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_paid_attempt_cannot_regress_on_failed_status_sync_without_legacy_transaction(): void
    {
        $order = Order::factory()->paid()->create();
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'sync-canonical-'.$order->id,
            'invoice_number' => $order->order_code, 'merchant_request_id' => 'sync-canonical-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Paid,
            'verification_status' => PaymentAttemptVerificationStatus::Verified,
        ]);
        Http::fake(['*/checkout/v1/payment/*' => Http::response(['order' => ['invoice_number' => $order->order_code], 'transaction' => ['status' => 'FAILED']])]);

        app(DokuService::class)->syncStatusFromDoku($attempt);

        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/checkout/v1/payment/'.$attempt->invoice_number));
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->fresh()->settlement_status);
        $this->assertDatabaseHas('payment_attempts', [
            'id' => $attempt->id,
            'invoice_number' => $order->order_code,
            'settlement_status' => PaymentAttemptSettlementStatus::Paid->value,
        ]);
        $this->assertDatabaseCount('payment_transactions', 0);
    }

    public function test_paid_transaction_cannot_regress_on_failed_status_sync(): void
    {
        $order = Order::factory()->paid()->create();
        $order->update(['doku_order_id' => $order->order_code]);
        PaymentTransaction::create([
            'order_id' => $order->id, 'doku_order_id' => $order->order_code,
            'payment_method' => 'qris', 'amount' => $order->total, 'status' => 'paid',
        ]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'sync-'.$order->id,
            'invoice_number' => $order->order_code, 'merchant_request_id' => 'sync-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Paid,
            'verification_status' => PaymentAttemptVerificationStatus::Verified,
        ]);
        Http::fake(['*/checkout/v1/payment/*' => Http::response(['order' => ['invoice_number' => $order->order_code], 'transaction' => ['status' => 'FAILED']])]);

        app(DokuService::class)->syncStatusFromDoku($attempt);

        Http::assertSentCount(1);
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->fresh()->settlement_status);
        $this->assertSame('paid', PaymentTransaction::where('order_id', $order->id)->sole()->status);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_paid_transaction_cannot_regress_on_ambiguous_status_sync(): void
    {
        $order = Order::factory()->paid()->create();
        $order->update(['doku_order_id' => $order->order_code]);
        PaymentTransaction::create([
            'order_id' => $order->id, 'doku_order_id' => $order->order_code,
            'payment_method' => 'qris', 'amount' => $order->total, 'status' => 'paid',
        ]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'sync-ambiguous-'.$order->id,
            'invoice_number' => $order->order_code, 'merchant_request_id' => 'sync-ambiguous-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Paid,
            'verification_status' => PaymentAttemptVerificationStatus::Verified,
        ]);
        Http::fake(['*/checkout/v1/payment/*' => Http::response([
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'PENDING_REVIEW'],
        ])]);

        app(DokuService::class)->syncStatusFromDoku($attempt);

        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/checkout/v1/payment/'.$attempt->invoice_number));
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->fresh()->settlement_status);
        $this->assertSame('paid', PaymentTransaction::where('order_id', $order->id)->sole()->status);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_paid_order_cannot_regress_on_late_failure(): void
    {
        $order = Order::factory()->create(['payment_status' => 'paid']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'paid',
        ]);

        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'late-failure-'.$order->id,
            'invoice_number' => $order->order_code,
            'merchant_request_id' => 'late-failure-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Paid,
            'verification_status' => PaymentAttemptVerificationStatus::Verified,
        ]);

        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'FAILED', 'amount' => $order->total],
        ]);

        $this->assertSame('paid', $order->fresh()->payment_status);
    }
}
