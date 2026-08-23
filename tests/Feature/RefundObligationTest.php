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

    public function test_destination_fields_are_encrypted_at_rest_and_round_trip(): void
    {
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id, 'attempt_key' => 'encrypted-attempt',
            'invoice_number' => 'encrypted-invoice', 'merchant_request_id' => 'encrypted-request',
            'amount_snapshot' => 12500, 'currency_snapshot' => 'IDR',
        ]);
        $obligation = app(RefundObligationService::class)->createForAttempt($attempt, 'encrypted');
        $obligation->update([
            'bank_name' => 'Bank Rahasia', 'account_number' => '123456789', 'account_holder' => 'Pemilik Rahasia',
            'ewallet_provider' => 'Dana', 'ewallet_number' => '08123456789', 'ewallet_holder' => 'Pemilik Ewallet',
        ]);

        $raw = DB::table('refund_obligations')->where('id', $obligation->id)->first();
        $this->assertNotSame('Bank Rahasia', $raw->bank_name);
        $this->assertSame('Bank Rahasia', $obligation->fresh()->bank_name);
        $this->assertSame('123456789', $obligation->fresh()->account_number);
    }

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

    public function test_duplicate_key_recovery_rejects_canonical_mismatch(): void
    {
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id, 'attempt_key' => 'mismatch-race', 'invoice_number' => 'mismatch-invoice',
            'merchant_request_id' => 'mismatch-request', 'amount_snapshot' => 12500, 'currency_snapshot' => 'IDR',
        ]);
        RefundObligation::create(['payment_attempt_id' => $attempt->id, 'amount' => 9999, 'currency' => 'IDR', 'reason' => 'mismatch']);

        $this->expectException(DomainException::class);
        app(RefundObligationService::class)->createForAttempt($attempt, 'mismatch');
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

    public function test_invalid_refund_amounts_are_reported_for_refund_status_rows(): void
    {
        foreach ([null, 0, -1, '1.234'] as $amount) {
            $order = Order::factory()->create(['payment_status' => 'refund_pending', 'refund_amount' => $amount]);
            DB::table('orders')->where('id', $order->id)->update(['refund_amount' => $amount]);
        }

        $this->runRefundBackfill();

        $this->assertDatabaseCount('refund_obligation_backfill_exceptions', 4);
        $this->assertDatabaseHas('refund_obligation_backfill_exceptions', ['reason' => 'invalid_refund_amount']);
    }

    public function test_large_decimal_amounts_use_exact_candidate_comparison(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refund_pending', 'refund_amount' => '9999999999.99']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'large-amount', 'invoice_number' => 'large-invoice',
            'merchant_request_id' => 'large-request', 'amount_snapshot' => '9999999999.99', 'currency_snapshot' => 'USD',
        ]);

        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligations', ['payment_attempt_id' => $attempt->id, 'amount' => '9999999999.99']);
    }

    public function test_malformed_destination_ciphertext_is_reported_and_skipped(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refund_pending', 'refund_amount' => 1000]);
        DB::table('orders')->where('id', $order->id)->update(['refund_bank_name' => 'legacy plaintext']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'malformed-destination', 'invoice_number' => 'malformed-invoice',
            'merchant_request_id' => 'malformed-request', 'amount_snapshot' => 1000, 'currency_snapshot' => 'IDR',
        ]);

        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligation_backfill_exceptions', ['order_id' => $order->id, 'reason' => 'invalid_refund_destination_ciphertext']);
        $this->assertDatabaseMissing('refund_obligations', ['payment_attempt_id' => $attempt->id]);
    }

    public function test_invalid_candidate_amount_is_reported_without_obligation(): void
    {
        Schema::table('payment_attempts', function ($table): void {
            $table->decimal('amount_snapshot', 12, 3)->change();
        });
        $order = Order::factory()->create(['total' => 1000, 'payment_status' => 'refund_pending', 'refund_amount' => 1000]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'invalid-candidate', 'invoice_number' => 'invalid-candidate-invoice',
            'merchant_request_id' => 'invalid-candidate-request', 'amount_snapshot' => '1.23', 'currency_snapshot' => 'IDR',
        ]);
        DB::table('payment_attempts')->where('id', $attempt->id)->update(['amount_snapshot' => '1.234']);

        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligation_backfill_exceptions', ['order_id' => $order->id, 'reason' => 'invalid_attempt_amount']);
        $this->assertDatabaseMissing('refund_obligations', ['payment_attempt_id' => $attempt->id]);
    }

    public function test_historical_refund_amount_mismatch_is_reported_without_obligation(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refund_pending', 'refund_amount' => 9000]);
        PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'mismatch-attempt', 'invoice_number' => 'mismatch-invoice',
            'merchant_request_id' => 'mismatch-request', 'amount_snapshot' => 8000, 'currency_snapshot' => 'IDR',
        ]);

        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligation_backfill_exceptions', ['order_id' => $order->id, 'reason' => 'refund_amount_mismatch_order_total', 'backfill_run_key' => '2026_08_23_000004_refund_obligations']);
        $this->assertDatabaseMissing('refund_obligations', ['amount' => 9000]);
    }

    public function test_historical_backfill_chooses_older_sufficient_attempt(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refund_pending', 'refund_amount' => 5000]);
        $older = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'older-sufficient', 'invoice_number' => 'older-invoice',
            'merchant_request_id' => 'older-request', 'amount_snapshot' => 8000, 'currency_snapshot' => 'IDR',
        ]);
        PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'newer-insufficient', 'invoice_number' => 'newer-invoice',
            'merchant_request_id' => 'newer-request', 'amount_snapshot' => 3000, 'currency_snapshot' => 'IDR',
        ]);

        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligations', ['payment_attempt_id' => $older->id, 'amount' => 5000]);
    }

    public function test_historical_backfill_reports_missing_existing_attempt_currency(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refund_pending', 'refund_amount' => 5000]);
        PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'missing-currency-attempt', 'invoice_number' => 'missing-currency-invoice',
            'merchant_request_id' => 'missing-currency-request', 'amount_snapshot' => 5000, 'currency_snapshot' => '',
        ]);

        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligation_backfill_exceptions', ['order_id' => $order->id, 'reason' => 'missing_currency']);
    }

    public function test_historical_backfill_reports_missing_synthesized_currency(): void
    {
        Schema::table('orders', function ($table): void {
            $table->char('currency', 3)->nullable();
        });
        $order = Order::factory()->create(['total' => 8000, 'payment_status' => 'refund_pending', 'refund_amount' => 8000, 'currency' => null]);

        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligation_backfill_exceptions', ['order_id' => $order->id, 'reason' => 'missing_currency']);
    }

    public function test_invalid_synthesized_currency_creates_exception_without_attempt(): void
    {
        Schema::table('orders', function ($table): void {
            $table->char('currency', 3)->nullable();
        });
        $order = Order::factory()->create([
            'total' => 8000, 'payment_status' => 'refund_pending', 'refund_amount' => 8000, 'currency' => 'usd',
        ]);

        $this->runRefundBackfill();

        $this->assertDatabaseHas('refund_obligation_backfill_exceptions', ['order_id' => $order->id, 'reason' => 'missing_currency']);
        $this->assertDatabaseMissing('payment_attempts', ['attempt_key' => 'legacy-refund-'.$order->id]);
    }

    public function test_historical_refund_backfill_synthesizes_missing_attempt(): void
    {
        Schema::table('orders', function ($table): void {
            $table->char('currency', 3)->nullable();
        });
        $order = Order::factory()->create([
            'total' => 8000, 'payment_status' => 'refund_pending', 'refund_amount' => 8000, 'currency' => 'IDR',
        ]);

        $this->runRefundBackfill();

        $attempt = PaymentAttempt::query()->where('attempt_key', 'legacy-refund-'.$order->id)->sole();
        $this->assertDatabaseHas('refund_obligations', ['payment_attempt_id' => $attempt->id, 'amount' => 8000]);
    }

    public function test_historical_refund_backfill_reports_unmappable_refund_and_recovers_on_rerun(): void
    {
        Schema::table('orders', function ($table): void {
            $table->char('currency', 3)->nullable();
        });
        $order = Order::factory()->create([
            'total' => 0, 'payment_status' => 'refund_pending', 'refund_amount' => 1000, 'currency' => 'IDR',
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
