<?php

namespace Tests\Feature;

use App\Enums\RefundObligationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Services\RefundObligationService;
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
