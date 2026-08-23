<?php

namespace Tests\Feature;

use App\Enums\RefundObligationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use App\Services\RefundObligationService;
use DomainException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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

    public function test_creation_requires_persisted_attempt_owned_by_order(): void
    {
        $attempt = new PaymentAttempt(['amount_snapshot' => 12500, 'currency_snapshot' => 'IDR']);

        $this->expectException(DomainException::class);
        app(RefundObligationService::class)->createForAttempt($attempt, 'unowned');
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
        $this->expectException(DomainException::class);
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

    public function test_database_rejects_zero_amount(): void
    {
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id,
            'attempt_key' => 'attempt-zero', 'invoice_number' => 'invoice-zero', 'merchant_request_id' => 'request-zero',
            'amount_snapshot' => 12500, 'currency_snapshot' => 'IDR',
        ]);

        $this->expectException(QueryException::class);
        DB::table('refund_obligations')->insert([
            'payment_attempt_id' => $attempt->id,
            'amount' => 0,
            'currency' => 'IDR',
            'reason' => 'zero',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
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

    public function test_historical_refund_backfill_maps_existing_attempt_and_reruns_idempotently(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'refunded', 'refund_amount' => 5000, 'refund_reason' => 'customer_cancellation',
        ]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'historical-existing', 'invoice_number' => 'invoice-existing',
            'merchant_request_id' => 'request-existing', 'amount_snapshot' => 10000, 'currency_snapshot' => 'IDR',
        ]);

        $this->runRefundBackfill();
        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligations', [
            'payment_attempt_id' => $attempt->id, 'amount' => 5000, 'reason' => 'customer_cancellation', 'status' => 'completed',
        ]);
        $this->assertDatabaseCount('refund_obligations', 1);
    }

    public function test_historical_refund_amount_mismatch_is_reported_without_obligation(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refund_pending', 'refund_amount' => 9000]);
        PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'mismatch-attempt', 'invoice_number' => 'mismatch-invoice',
            'merchant_request_id' => 'mismatch-request', 'amount_snapshot' => 8000, 'currency_snapshot' => 'IDR',
        ]);

        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligation_backfill_exceptions', ['order_id' => $order->id, 'reason' => 'refund_exceeds_attempt_amount', 'backfill_run_key' => '2026_08_23_000004_refund_obligations']);
        $this->assertDatabaseMissing('refund_obligations', ['amount' => 9000]);
    }

    public function test_historical_refund_backfill_synthesizes_missing_attempt(): void
    {
        $order = Order::factory()->create([
            'total' => 8000, 'payment_status' => 'refund_pending', 'refund_amount' => 8000,
        ]);

        $this->runRefundBackfill();

        $attempt = PaymentAttempt::query()->where('attempt_key', 'legacy-refund-'.$order->id)->sole();
        $this->assertDatabaseHas('refund_obligations', ['payment_attempt_id' => $attempt->id, 'amount' => 8000]);
    }

    public function test_historical_refund_backfill_reports_unmappable_refund_and_recovers_on_rerun(): void
    {
        $order = Order::factory()->create([
            'total' => 0, 'payment_status' => 'refund_pending', 'refund_amount' => 1000,
        ]);

        $this->runRefundBackfill();
        $this->assertDatabaseHas('refund_obligation_backfill_exceptions', ['order_id' => $order->id]);

        $order->update(['total' => 1000]);
        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligations', ['amount' => 1000]);
        $this->assertDatabaseCount('refund_obligations', 1);
    }

    private function runRefundBackfill(): void
    {
        $migration = require database_path('migrations/2026_08_23_000004_backfill_refund_obligations.php');
        $migration->up();
    }

    public function test_backfill_down_removes_only_backfill_records(): void
    {
        $order = Order::factory()->create(['total' => 8000, 'payment_status' => 'refund_pending', 'refund_amount' => 8000]);
        $this->runRefundBackfill();
        $attemptId = PaymentAttempt::query()->where('attempt_key', 'legacy-refund-'.$order->id)->value('id');
        $migration = require database_path('migrations/2026_08_23_000004_backfill_refund_obligations.php');
        $migration->down();

        $this->assertDatabaseMissing('refund_obligations', ['payment_attempt_id' => $attemptId]);
        $this->assertDatabaseMissing('payment_attempts', ['attempt_key' => 'legacy-refund-'.$order->id]);
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
