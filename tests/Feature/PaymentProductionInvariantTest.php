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

    public function test_status_sync_reads_amount_from_order_payload_and_marks_paid(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending', 'total' => 50000]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'sync-order-amount-'.$order->id,
            'invoice_number' => 'SYNC-ORDER-AMOUNT', 'merchant_request_id' => 'sync-order-amount-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);

        // DOKU Check Status API reports the amount under `order.amount`; there is
        // no `transaction.amount`. Reading only the transaction path used to
        // leave the attempt in needs_review, so the order never became paid.
        Http::fake(['*/orders/v1/status/*' => Http::response([
            'order' => ['invoice_number' => $attempt->invoice_number, 'amount' => 50000, 'currency' => 'IDR'],
            'transaction' => ['status' => 'SUCCESS', 'original_request_id' => 'provider-ref-1'],
        ])]);

        app(DokuService::class)->syncStatusFromDoku($attempt);

        $attempt = $attempt->fresh();
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->settlement_status);
        $this->assertSame(PaymentAttemptVerificationStatus::Verified, $attempt->verification_status);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_status_sync_accepts_float_amount_from_provider(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending', 'total' => 50000]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'sync-float-amount-'.$order->id,
            'invoice_number' => 'SYNC-FLOAT-AMOUNT', 'merchant_request_id' => 'sync-float-amount-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);

        // JSON numbers with a decimal point decode to float in PHP.
        Http::fake(['*/orders/v1/status/*' => Http::response([
            'order' => ['invoice_number' => $attempt->invoice_number, 'amount' => 50000.0, 'currency' => 'IDR'],
            'transaction' => ['status' => 'SUCCESS'],
        ])]);

        app(DokuService::class)->syncStatusFromDoku($attempt);

        $attempt = $attempt->fresh();
        $this->assertSame(PaymentAttemptVerificationStatus::Verified, $attempt->verification_status);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_webhook_success_reads_amount_from_order_payload(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending', 'total' => 50000]);
        PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'webhook-order-amount-'.$order->id,
            'invoice_number' => 'WEBHOOK-ORDER-AMOUNT', 'merchant_request_id' => 'webhook-order-amount-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);

        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => 'WEBHOOK-ORDER-AMOUNT', 'amount' => 50000, 'currency' => 'IDR'],
            'transaction' => ['status' => 'SUCCESS'],
        ]);

        $attempt = PaymentAttempt::where('order_id', $order->id)->sole();
        $this->assertSame(PaymentAttemptVerificationStatus::Verified, $attempt->verification_status);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_status_sync_queries_documented_check_status_endpoint(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending', 'total' => 50000]);

        Http::fake(['*/orders/v1/status/*' => Http::response([
            'order' => ['invoice_number' => 'ENDPOINT-1', 'amount' => 50000],
            'transaction' => ['status' => 'PENDING'],
        ])]);

        app(DokuService::class)->checkStatus($order->forceFill(['doku_order_id' => 'ENDPOINT-1']));

        Http::assertSent(fn ($request) => $request->method() === 'GET'
            && str_ends_with($request->url(), '/orders/v1/status/ENDPOINT-1'));
        Http::assertNotSent(fn ($request) => str_contains($request->url(), '/checkout/v1/payment/'));
    }

    public function test_status_sync_signature_omits_digest_for_get_requests(): void
    {
        config(['doku.client_id' => 'test-client', 'doku.api_key' => 'test-key', 'doku.base_url' => 'https://api-sandbox.doku.com']);

        $order = Order::factory()->create(['payment_status' => 'pending', 'total' => 50000]);
        $sent = [];

        Http::fake(['*/orders/v1/status/*' => function ($request) use (&$sent) {
            $sent[] = $request;

            return Http::response([
                'order' => ['invoice_number' => 'SIG-1', 'amount' => 50000],
                'transaction' => ['status' => 'PENDING'],
            ]);
        }]);

        app(DokuService::class)->checkStatus($order->forceFill(['doku_order_id' => 'SIG-1']));

        $request = $sent[0];
        $endpoint = '/orders/v1/status/SIG-1';
        $timestamp = $request->header('Request-Timestamp')[0];
        $requestId = $request->header('Request-Id')[0];

        // DOKU rejects any Digest line on GET endpoints with 400
        // invalid_signature; the component set must end at Request-Target.
        $assembled = 'Client-Id:test-client'."\n"
            .'Request-Id:'.$requestId."\n"
            .'Request-Timestamp:'.$timestamp."\n"
            .'Request-Target:'.$endpoint;
        $expected = 'HMACSHA256='.base64_encode(hash_hmac('sha256', $assembled, 'test-key', true));

        $this->assertSame($expected, $request->header('Signature')[0]);
    }

    public function test_payment_due_date_is_sent_inside_payment_object(): void
    {
        config(['doku.payment_timeout' => 30]);

        $order = Order::factory()->create([
            'payment_status' => 'pending',
            'total' => 50000,
            'confirmation_expires_at' => now()->addMinutes(30),
        ]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'due-date-'.$order->id,
            'invoice_number' => 'DUE-DATE-1', 'merchant_request_id' => 'due-date-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);

        Http::fake(['*/checkout/v1/payment' => Http::response([
            'response' => ['payment' => ['url' => 'https://sandbox.doku.com/pay/due']],
        ], 200)]);

        app(DokuService::class)->createPayment($attempt);

        // DOKU reads `payment.payment_due_date`. Placing it under `order` is
        // silently ignored and DOKU falls back to its 60 minute default, which
        // outlives Dombi's own expiry and invites late payments.
        Http::assertSent(fn ($request) => $request['payment']['payment_due_date'] === 30
            && ! isset($request['order']['payment_due_date']));
    }

    public function test_payment_due_date_never_exceeds_order_deadline(): void
    {
        config(['doku.payment_timeout' => 60]);

        $order = Order::factory()->create([
            'payment_status' => 'pending',
            'total' => 50000,
            'confirmation_expires_at' => now()->addMinutes(12),
        ]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'due-date-cap-'.$order->id,
            'invoice_number' => 'DUE-DATE-2', 'merchant_request_id' => 'due-date-cap-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);

        Http::fake(['*/checkout/v1/payment' => Http::response([
            'response' => ['payment' => ['url' => 'https://sandbox.doku.com/pay/due2']],
        ], 200)]);

        app(DokuService::class)->createPayment($attempt);

        // Exactly the remaining order window, not the 60 minute config value.
        Http::assertSent(fn ($request) => $request['payment']['payment_due_date'] === 12);
    }

    public function test_status_sync_treats_order_expired_as_terminal_expiry(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending', 'total' => 50000]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'order-expired-'.$order->id,
            'invoice_number' => 'ORDER-EXPIRED-1', 'merchant_request_id' => 'order-expired-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
            'creation_state' => 'created',
        ]);

        // DOKU keeps transaction.status at PENDING while order.status lapses to
        // ORDER_EXPIRED. Without mapping the order-level status the attempt
        // stays pending forever and the order never reaches a terminal state.
        Http::fake(['*/orders/v1/status/*' => Http::response([
            'order' => ['invoice_number' => $attempt->invoice_number, 'amount' => 50000, 'status' => 'ORDER_EXPIRED'],
            'transaction' => ['status' => 'PENDING'],
        ])]);

        $result = app(DokuService::class)->syncStatusFromDoku($attempt);

        $this->assertSame('expired', $result);
        $this->assertSame(PaymentAttemptSettlementStatus::Expired, $attempt->fresh()->settlement_status);
        // The provider retired the session, so the attempt must leave `created`.
        // Otherwise pay() answers 409 "sedang diproses" forever and the
        // customer can never start a fresh attempt.
        $this->assertSame('failed', $attempt->fresh()->creation_state?->value);
    }

    public function test_status_sync_keeps_generated_order_pending(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending', 'total' => 50000]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'order-generated-'.$order->id,
            'invoice_number' => 'ORDER-GENERATED-1', 'merchant_request_id' => 'order-generated-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);

        Http::fake(['*/orders/v1/status/*' => Http::response([
            'order' => ['invoice_number' => $attempt->invoice_number, 'amount' => 50000, 'status' => 'ORDER_GENERATED'],
            'transaction' => ['status' => 'PENDING'],
        ])]);

        $result = app(DokuService::class)->syncStatusFromDoku($attempt);

        $this->assertSame('pending', $result);
        $this->assertSame('pending', $order->fresh()->payment_status);
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
        Http::fake(['*/orders/v1/status/*' => Http::response(['order' => ['invoice_number' => $order->order_code], 'transaction' => ['status' => 'FAILED']])]);

        app(DokuService::class)->syncStatusFromDoku($attempt);

        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/orders/v1/status/'.$attempt->invoice_number));
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
        Http::fake(['*/orders/v1/status/*' => Http::response(['order' => ['invoice_number' => $order->order_code], 'transaction' => ['status' => 'FAILED']])]);

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
        Http::fake(['*/orders/v1/status/*' => Http::response([
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'PENDING_REVIEW'],
        ])]);

        app(DokuService::class)->syncStatusFromDoku($attempt);

        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/orders/v1/status/'.$attempt->invoice_number));
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
