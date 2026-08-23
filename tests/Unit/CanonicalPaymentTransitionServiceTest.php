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

    public function test_success_matching_amount_is_verified_and_paid(): void
    {
        [$order, $attempt] = $this->attempt();

        $result = app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            source: 'doku', gatewayStatus: 'SUCCESS', amount: 50000, currency: 'IDR', gatewayReference: 'gw-1', receivedAt: now(), rawEvidence: []
        ));

        $attempt = $attempt->fresh();
        $this->assertTrue($result->changed);
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->settlement_status);
        $this->assertSame(PaymentAttemptVerificationStatus::Verified, $attempt->verification_status);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_success_amount_mismatch_is_paid_but_needs_review(): void
    {
        [$order, $attempt] = $this->attempt();

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 49000, 'IDR', 'gw-2', now(), []
        ));

        $attempt = $attempt->fresh();
        $this->assertSame(PaymentAttemptSettlementStatus::Paid, $attempt->settlement_status);
        $this->assertSame(PaymentAttemptVerificationStatus::NeedsReview, $attempt->verification_status);
        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_late_failure_cannot_regress_paid_attempt_and_duplicate_success_creates_one_obligation(): void
    {
        [$order, $attempt] = $this->attempt(['status' => Order::STATUS_CANCELLED_BY_CUSTOMER]);
        $service = app(CanonicalPaymentTransitionService::class);
        $success = new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'gw-3', now(), []);
        $service->apply($attempt, $success);
        $service->apply($attempt->fresh(), new NormalizedPaymentEvent('doku', 'FAILED', 50000, 'IDR', 'gw-3', now()->addMinute(), []));
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
        $event = new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'gw-4', now(), []);

        $firstResult = $service->apply($first, $event);
        $secondResult = $service->apply($second, $event);

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
