<?php

namespace Tests\Feature;

use App\Console\Commands\VerifyPaymentCutover;
use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Enums\RefundObligationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CanonicalPaymentVerifierTest extends TestCase
{
    use RefreshDatabase;

    public function test_verifier_succeeds_without_deployment_evidence_when_legacy_writes_are_disabled(): void
    {
        config([
            'doku.legacy_writes_enabled' => false,
            'doku.legacy_writes_deployment_evidence' => null,
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

    public function test_verifier_fails_when_canonical_database_has_no_payment_attempts(): void
    {
        config(['doku.legacy_writes_enabled' => false]);

        $this->artisan('payments:verify-cutover')
            ->assertExitCode(1)
            ->expectsOutputToContain('at least one canonical payment attempt');
    }

    public function test_verifier_compares_decimal_amounts_exactly(): void
    {
        config(['doku.legacy_writes_enabled' => false]);
        $order = Order::factory()->create(['total' => '100.10', 'payment_status' => 'paid']);
        DB::table('payment_attempts')->insert([
            'order_id' => $order->id,
            'attempt_key' => 'invalid-state-'.$order->id,
            'invoice_number' => $order->order_code,
            'merchant_request_id' => 'invalid-state-request-'.$order->id,
            'amount_snapshot' => '100.11',
            'currency_snapshot' => 'IDR',
            'settlement_status' => 'pending',
            'verification_status' => 'verified',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('payments:verify-cutover')
            ->assertExitCode(1)
            ->expectsOutputToContain('amount');
    }

    public function test_verifier_rejects_malformed_and_over_precision_amounts(): void
    {
        config(['doku.legacy_writes_enabled' => false]);
        $method = new \ReflectionMethod(VerifyPaymentCutover::class, 'minorUnits');
        $method->setAccessible(true);

        $this->assertNull($method->invoke(null, 'not-a-number'));
        $this->assertNull($method->invoke(null, '100.123'));
        $this->assertNull($method->invoke(null, ''));
        $this->assertNull($method->invoke(null, '999999999999999999999999999999.99'));
        $this->assertSame(10010, $method->invoke(null, '100.10'));
    }

    public function test_verifier_rejects_over_precision_refund_amount(): void
    {
        $method = new \ReflectionMethod(VerifyPaymentCutover::class, 'minorUnits');
        $method->setAccessible(true);

        $this->assertNull($method->invoke(null, '10.001'));
        $this->assertNull($method->invoke(null, 'refund'));
        $this->assertSame(1000, $method->invoke(null, '10.00'));
    }

    public function test_verifier_reports_invalid_canonical_attempt_and_refund_obligation(): void
    {
        config(['doku.legacy_writes_enabled' => false, 'doku.payment_cutover_at' => null]);
        $order = Order::factory()->create(['total' => 100, 'payment_status' => 'paid']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'invalid-'.$order->id,
            'invoice_number' => 'wrong-invoice',
            'merchant_request_id' => 'invalid-request-'.$order->id,
            'amount_snapshot' => 99,
            'currency_snapshot' => 'USD',
            'settlement_status' => PaymentAttemptSettlementStatus::Failed,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);
        $otherOrder = Order::factory()->create();
        RefundObligation::create([
            'payment_attempt_id' => $attempt->id,
            'amount' => 10,
            'currency' => 'EUR',
            'reason' => 'test',
            'status' => RefundObligationStatus::Pending,
        ]);
        $attempt->order_id = $otherOrder->id;
        $attempt->saveQuietly();

        $this->artisan('payments:verify-cutover')
            ->assertExitCode(1)
            ->expectsOutputToContain('canonical attempt');
    }

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
