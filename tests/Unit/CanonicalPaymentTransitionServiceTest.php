<?php

namespace Tests\Unit;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use App\Services\CanonicalPaymentTransitionService;
use App\Services\NormalizedPaymentEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CanonicalPaymentTransitionServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_aggregate_lock_order_is_order_then_attempt(): void
    {
        $service = file_get_contents(app_path('Services/CanonicalPaymentTransitionService.php'));
        $projection = file_get_contents(app_path('Services/OrderPaymentProjectionService.php'));
        $webhook = file_get_contents(app_path('Services/DokuService.php'));

        $this->assertLessThan(
            strpos($service, 'PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()'),
            strpos($service, 'Order::query()->whereKey($attempt->order_id)->lockForUpdate()')
        );
        $this->assertLessThan(
            strpos($projection, 'PaymentAttempt::query()->where(\'order_id\''),
            strpos($projection, 'Order::query()->whereKey($order->id)->lockForUpdate()')
        );
        $this->assertLessThan(
            strpos($webhook, 'PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()'),
            strpos($webhook, 'Order::query()->whereKey($attempt->order_id)->lockForUpdate()')
        );
    }

    public function test_repeated_failed_event_does_not_reset_payment_retry_window(): void
    {
        [$order, $attempt] = $this->attempt();
        config(['order.payment_retry_window_minutes' => 17]);
        $service = app(CanonicalPaymentTransitionService::class);
        $event = new NormalizedPaymentEvent('doku', 'FAILED', null, 'IDR', 'invoice-first', now(), []);
        $service->apply($attempt, $event);
        $first = $order->fresh()->confirmation_expires_at;
        $service->apply($attempt->fresh(), new NormalizedPaymentEvent('doku', 'FAILED', null, 'IDR', 'invoice-first', now()->addMinute(), []));

        $this->assertSame($first->toIso8601String(), $order->fresh()->confirmation_expires_at->toIso8601String());
    }

    public function test_failed_transition_sets_payment_retry_window_on_pending_order(): void
    {
        [$order, $attempt] = $this->attempt();
        config(['order.payment_retry_window_minutes' => 17]);
        $before = now();

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'FAILED', null, 'IDR', 'invoice-first', now(), []
        ));

        $expires = $order->fresh()->confirmation_expires_at;
        $this->assertNotNull($expires);
        $this->assertTrue($expires->between($before->copy()->addMinutes(17)->subSecond(), now()->addMinutes(17)->addSecond()));
    }

    public function test_terminal_order_success_is_paid_but_creates_refund_without_claiming(): void
    {
        [$order, $attempt] = $this->attempt(['status' => Order::STATUS_CANCELLED_BY_CUSTOMER]);

        $result = app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []
        ));

        $this->assertFalse($result->fulfilmentWinner);
        $this->assertNull($attempt->fresh()->fulfilment_claimed_at);
        $this->assertSame(1, RefundObligation::where('payment_attempt_id', $attempt->id)->count());
    }

    public function test_unmatched_gateway_reference_is_evidence_only_and_canonical_invoice_remains(): void
    {
        [, $attempt] = $this->attempt();

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 50000, 'IDR', 'transaction-id', now(), ['order' => ['invoice_number' => 'invoice-first']]
        ));

        $fresh = $attempt->fresh();
        $this->assertSame('invoice-first', $fresh->invoice_number);
        $this->assertSame('transaction-id', $fresh->gateway_transaction_id);
        $this->assertSame('paid', $fresh->settlement_status->value);
    }

    public function test_legacy_webhook_attempt_stays_needs_review_until_reconciliation(): void
    {
        [, $attempt] = $this->attempt();
        $attempt->update(['metadata' => ['legacy_webhook_needs_review' => true]]);

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []
        ));

        $this->assertSame(PaymentAttemptVerificationStatus::NeedsReview, $attempt->fresh()->verification_status);
    }

    public function test_missing_later_amount_preserves_existing_gateway_amount(): void
    {
        [, $attempt] = $this->attempt();
        $service = app(CanonicalPaymentTransitionService::class);
        $service->apply($attempt, new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'provider-1', now(), []));
        $service->apply($attempt->fresh(), new NormalizedPaymentEvent('doku', 'SUCCESS', null, 'IDR', 'provider-1', now()->addMinute(), []));

        $this->assertSame('50000.00', $attempt->fresh()->gateway_amount);
    }

    public function test_success_without_gateway_amount_is_paid_but_needs_review_and_cannot_fulfil(): void
    {
        [, $attempt] = $this->attempt();

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'manual', 'paid', null, 'IDR', 'invoice-first', now(), []
        ));

        $fresh = $attempt->fresh();
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $fresh->settlement_status);
        $this->assertSame(PaymentAttemptVerificationStatus::NeedsReview, $fresh->verification_status);
        $this->assertNull($fresh->fulfilment_claimed_at);
    }

    public function test_success_matching_amount_is_verified_and_paid(): void
    {
        [$order, $attempt] = $this->attempt();

        $result = app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            source: 'doku', gatewayStatus: 'SUCCESS', amount: 50000, currency: 'IDR', gatewayReference: 'invoice-first', receivedAt: now(), rawEvidence: []
        ));

        $attempt = $attempt->fresh();
        $this->assertTrue($result->changed);
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->settlement_status);
        $this->assertSame(PaymentAttemptVerificationStatus::Verified, $attempt->verification_status);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_unknown_status_persists_evidence_without_state_change(): void
    {
        [, $attempt] = $this->attempt();

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'UNKNOWN', null, 'IDR', 'invoice-first', now(), ['event' => 'unknown']
        ));

        $attempt = $attempt->fresh();
        $this->assertSame(PaymentAttemptSettlementStatus::Unknown, $attempt->settlement_status);
        $this->assertSame(['event' => 'unknown'], $attempt->raw_response);
    }

    public function test_transaction_reference_is_evidence_not_identity_rejection(): void
    {
        [, $attempt] = $this->attempt();

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 50000, 'IDR', 'transaction-reference', now(), []
        ));

        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->fresh()->settlement_status);
    }

    public function test_currency_must_match_attempt(): void
    {
        [, $attempt] = $this->attempt();

        $this->expectException(\InvalidArgumentException::class);
        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 50000, 'USD', 'invoice-first', now(), []
        ));
    }

    public function test_verified_attempt_stays_verified_on_later_anomalous_success(): void
    {
        [, $attempt] = $this->attempt();
        $service = app(CanonicalPaymentTransitionService::class);
        $service->apply($attempt, new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []));
        $service->apply($attempt->fresh(), new NormalizedPaymentEvent('doku', 'SUCCESS', 49000, 'IDR', 'invoice-first', now(), ['anomaly' => true]));

        $this->assertSame(PaymentAttemptVerificationStatus::Verified, $attempt->fresh()->verification_status);
        $this->assertSame(['anomaly' => true], $attempt->fresh()->raw_response);
    }

    public function test_success_amount_mismatch_is_paid_but_needs_review(): void
    {
        [$order, $attempt] = $this->attempt();

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 49000, 'IDR', 'invoice-first', now(), []
        ));

        $attempt = $attempt->fresh();
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->settlement_status);
        $this->assertSame(PaymentAttemptVerificationStatus::NeedsReview, $attempt->verification_status);
        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_same_attempt_duplicate_success_is_idempotent_without_self_refund(): void
    {
        [, $attempt] = $this->attempt();
        $service = app(CanonicalPaymentTransitionService::class);
        $event = new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []);

        $first = $service->apply($attempt, $event);
        $second = $service->apply($attempt->fresh(), $event);

        $this->assertTrue($first->fulfilmentWinner);
        $this->assertTrue($second->fulfilmentWinner);
        $this->assertSame(0, RefundObligation::count());
    }

    public function test_stale_event_does_not_overwrite_newer_evidence_or_state(): void
    {
        [, $attempt] = $this->attempt();
        $service = app(CanonicalPaymentTransitionService::class);
        $service->apply($attempt, new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), ['new' => true]));
        $service->apply($attempt->fresh(), new NormalizedPaymentEvent('doku', 'FAILED', 50000, 'IDR', 'invoice-first', now()->subMinute(), ['old' => true]));

        $fresh = $attempt->fresh();
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $fresh->settlement_status);
        $this->assertSame(['new' => true], $fresh->raw_response);
    }

    public function test_late_failure_cannot_regress_paid_attempt_and_duplicate_success_creates_one_obligation(): void
    {
        [$order, $attempt] = $this->attempt(['status' => Order::STATUS_CANCELLED_BY_CUSTOMER]);
        $service = app(CanonicalPaymentTransitionService::class);
        $success = new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []);
        $service->apply($attempt, $success);
        $service->apply($attempt->fresh(), new NormalizedPaymentEvent('doku', 'FAILED', 50000, 'IDR', 'invoice-first', now()->addMinute(), []));
        $service->apply($attempt->fresh(), $success);

        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->fresh()->settlement_status);
        $this->assertSame(1, RefundObligation::where('payment_attempt_id', $attempt->id)->count());
    }

    public function test_only_one_paid_attempt_claims_fulfilment(): void
    {
        [$order, $first] = $this->attempt();
        $second = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'second', 'invoice_number' => 'invoice-second',
            'merchant_request_id' => 'request-second', 'amount_snapshot' => 50000, 'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Pending,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);
        $service = app(CanonicalPaymentTransitionService::class);
        $event = new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []);

        $firstResult = $service->apply($first, $event);
        $secondResult = $service->apply($second, new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-second', now(), []));

        $this->assertTrue($firstResult->fulfilmentWinner);
        $this->assertFalse($secondResult->fulfilmentWinner);
        $this->assertSame(1, RefundObligation::where('reason', 'duplicate_paid_attempt')->count());
    }

    private function attempt(array $order = [], string $key = 'first'): array
    {
        $orderModel = Order::factory()->create($order + ['total' => 50000, 'payment_status' => 'pending']);
        $attempt = PaymentAttempt::create([
            'order_id' => $orderModel->id, 'attempt_key' => $key, 'invoice_number' => 'invoice-'.$key,
            'merchant_request_id' => 'request-'.$key, 'amount_snapshot' => 50000, 'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Pending,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);

        return [$orderModel, $attempt];
    }
}
