<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use App\Services\CanonicalPaymentTransitionService;
use App\Services\NormalizedPaymentEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentFulfilmentConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_one_successful_attempt_claims_order_fulfilment(): void
    {
        $order = Order::factory()->create(['total' => 50000, 'payment_status' => 'pending']);
        $first = $this->attempt($order, 'first', 'invoice-first');
        $second = $this->attempt($order, 'second', 'invoice-second');
        $event = fn (string $invoice) => new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', $invoice, now(), []);

        app(CanonicalPaymentTransitionService::class)->apply($first, $event('invoice-first'));
        app(CanonicalPaymentTransitionService::class)->apply($second, $event('invoice-second'));

        $this->assertNotNull($order->fresh()->fulfilment_claimed_at);
        $this->assertSame(1, PaymentAttempt::whereNotNull('fulfilment_claimed_at')->count());
        $this->assertSame(1, RefundObligation::where('reason', 'duplicate_paid_attempt')->count());
    }

    private function attempt(Order $order, string $key, string $invoice): PaymentAttempt
    {
        return PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => $key,
            'invoice_number' => $invoice,
            'merchant_request_id' => $key.'-request',
            'amount_snapshot' => 50000,
            'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Pending,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);
    }
}
