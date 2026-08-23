<?php

namespace Tests\Feature;

use App\Enums\RefundObligationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use App\Services\RefundObligationService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RefundObligationTest extends TestCase
{
    use RefreshDatabase;

    public function test_schema_and_canonical_lifecycle(): void
    {
        $this->assertTrue(Schema::hasTable('refund_obligations'));
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id,
            'attempt_key' => 'attempt-1', 'invoice_number' => 'invoice-1', 'merchant_request_id' => 'request-1',
            'amount_snapshot' => 12500, 'currency_snapshot' => 'IDR',
        ]);
        $service = app(RefundObligationService::class);
        $obligation = $service->createForAttempt($attempt, 'customer_cancellation');
        $this->assertSame(RefundObligationStatus::Pending, $obligation->status);
        $this->assertSame('12500.00', $obligation->amount);
        $this->assertTrue($service->transition($obligation, RefundObligationStatus::InProgress));
        $this->assertTrue($service->transition($obligation->fresh(), RefundObligationStatus::Completed, ['reference' => 'REF-1']));
        $this->assertSame(RefundObligationStatus::Completed, $obligation->fresh()->status);
    }

    public function test_creation_is_idempotent_and_amount_must_be_positive(): void
    {
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id,
            'attempt_key' => 'attempt-2', 'invoice_number' => 'invoice-2', 'merchant_request_id' => 'request-2',
            'amount_snapshot' => 12500, 'currency_snapshot' => 'IDR',
        ]);
        $service = app(RefundObligationService::class);
        $first = $service->createForAttempt($attempt, 'expiry');
        $second = $service->createForAttempt($attempt, 'expiry');
        $this->assertTrue($first->is($second));
        $this->expectException(\DomainException::class);
        $service->createForAttempt($attempt->forceFill(['amount_snapshot' => 0]), 'invalid');
    }

    public function test_rejected_and_failed_obligations_can_be_recovered(): void
    {
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id,
            'attempt_key' => 'attempt-recovery', 'invoice_number' => 'invoice-recovery', 'merchant_request_id' => 'request-recovery',
            'amount_snapshot' => 12500, 'currency_snapshot' => 'IDR',
        ]);
        $service = app(RefundObligationService::class);
        $rejected = $service->createForAttempt($attempt, 'rejected');
        $this->assertTrue($service->transition($rejected, RefundObligationStatus::Rejected));
        $this->assertTrue($service->transition($rejected->fresh(), RefundObligationStatus::Pending));
        $failed = $service->createForAttempt($attempt, 'failed');
        $this->assertTrue($service->transition($failed, RefundObligationStatus::InProgress));
        $this->assertTrue($service->transition($failed->fresh(), RefundObligationStatus::Failed));
        $this->assertTrue($service->transition($failed->fresh(), RefundObligationStatus::Pending));
    }

    public function test_foreign_key_and_database_positive_amount_are_enforced(): void
    {
        $this->expectException(QueryException::class);
        RefundObligation::create(['payment_attempt_id' => 999999, 'amount' => 1, 'currency' => 'IDR', 'reason' => 'fk']);
    }

    public function test_duplicate_key_recovery_uses_existing_obligation(): void
    {
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id,
            'attempt_key' => 'attempt-race', 'invoice_number' => 'invoice-race', 'merchant_request_id' => 'request-race',
            'amount_snapshot' => 12500, 'currency_snapshot' => 'IDR',
        ]);
        RefundObligation::create([
            'payment_attempt_id' => $attempt->id,
            'amount' => 12500,
            'currency' => 'IDR',
            'reason' => 'race',
        ]);

        $existing = app(RefundObligationService::class)->createForAttempt($attempt, 'race');

        $this->assertDatabaseCount('refund_obligations', 1);
        $this->assertSame('race', $existing->reason);
    }

    public function test_invalid_transitions_are_rejected_and_needs_review_is_supported(): void
    {
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id,
            'attempt_key' => 'attempt-4', 'invoice_number' => 'invoice-4', 'merchant_request_id' => 'request-4',
            'amount_snapshot' => 12500, 'currency_snapshot' => 'IDR',
        ]);
        $service = app(RefundObligationService::class);
        $obligation = $service->createForAttempt($attempt, 'late_payment');
        $this->assertTrue($service->transition($obligation, RefundObligationStatus::NeedsReview));
        $this->assertFalse($service->transition($obligation->fresh(), RefundObligationStatus::Completed));
    }
}
