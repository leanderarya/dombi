<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CanonicalPaymentVerifierTest extends TestCase
{
    use RefreshDatabase;

    public function test_verifier_succeeds_with_valid_canonical_data_without_cutover_timestamp(): void
    {
        config([
            'doku.legacy_writes_enabled' => false,
            'doku.legacy_writes_deployment_evidence' => 'false',
            'doku.payment_cutover_at' => null,
        ]);
        $order = Order::factory()->create(['payment_status' => 'paid']);
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'canonical-'.$order->id,
            'invoice_number' => $order->order_code,
            'merchant_request_id' => 'canonical-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Paid,
            'verification_status' => PaymentAttemptVerificationStatus::Verified,
        ]);

        $this->artisan('payments:verify-cutover')
            ->assertExitCode(0)
            ->expectsOutputToContain('READY');
    }
}
