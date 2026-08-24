<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use App\Services\DokuService;
use App\Services\NormalizedPaymentEvent;
use App\Services\PaymentObservabilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PaymentProductionMatrixTest extends TestCase
{
    use RefreshDatabase;

    public function test_observability_registry_exposes_fixed_schema_and_safe_allowlisted_labels(): void
    {
        $observability = app(PaymentObservabilityService::class);
        $observability->event('invalid_response', [
            'order_id' => 1,
            'attempt_id' => 2,
            'invoice_number' => 'INV-1',
            'request_id' => null,
            'gateway_reference' => null,
            'mapped_status' => 'unknown',
            'processing_result' => 'unknown',
            'error_reason' => 'missing_payment_url',
        ]);

        $events = $observability->events();
        $event = end($events);
        $this->assertSame([
            'order_id', 'attempt_id', 'invoice_number', 'request_id', 'gateway_reference',
            'mapped_status', 'processing_result', 'error_reason',
        ], array_keys($event['labels']));
        $this->assertSame('invalid_response', $event['name']);
        $this->assertSame(1, $observability->counters()['payment_invalid_response']);
        $this->assertArrayHasKey('payment_pending_age_seconds', $observability->gauges());
        $this->assertArrayNotHasKey('raw_body', $event['labels']);
    }

    public function test_cutover_legacy_write_guard_defaults_disabled(): void
    {
        $this->assertFalse(config('doku.legacy_writes_enabled'));
    }

    public function test_cutover_verification_fails_when_legacy_row_has_no_matching_attempt(): void
    {
        $order = Order::factory()->create();
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'LEGACY-MISSING',
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'paid',
        ]);

        $this->artisan('payments:verify-cutover')->assertExitCode(1);
    }

    public function test_observability_rejects_unknown_context_labels_and_computes_pending_age(): void
    {
        $observability = app(PaymentObservabilityService::class);
        Date::setTestNow(now());
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id,
            'attempt_key' => 'age-'.uniqid(),
            'invoice_number' => 'AGE-1',
            'merchant_request_id' => 'AGE-REQ',
            'amount_snapshot' => 100,
            'currency_snapshot' => 'IDR',
            'creation_state' => 'pending',
        ]);
        DB::table('payment_attempts')->where('id', $attempt->id)->update(['created_at' => now()->subMinutes(3)->toDateTimeString()]);
        $observability->refreshPendingAgeGauge();
        $this->assertGreaterThanOrEqual(180, $observability->gauges()['payment_pending_age_seconds']);
        $this->expectException(\InvalidArgumentException::class);
        $observability->event('webhook_rejected', ['unknown_label' => 'nope']);
    }

    public function test_all_emitted_events_are_registered(): void
    {
        $this->assertContains('webhook_rejected', PaymentObservabilityService::registeredEventNames());
        $this->assertContains('transition', PaymentObservabilityService::registeredEventNames());
        $this->assertContains('reconciliation', PaymentObservabilityService::registeredEventNames());
    }

    public function test_backfill_dry_run_failure_is_read_only_and_returns_failure(): void
    {
        $order = Order::factory()->create();
        PaymentTransaction::create(['order_id' => $order->id, 'doku_order_id' => 'DRY-BAD', 'payment_method' => 'qris', 'amount' => 100, 'status' => 'unsupported']);
        $before = DB::table('payment_attempts')->count();
        $storagePath = storage_path('app/payment-attempt-backfill-exceptions.txt');
        @unlink($storagePath);
        $this->artisan('payments:backfill-attempts --dry-run')->assertExitCode(1);
        $this->assertSame($before, DB::table('payment_attempts')->count());
        $this->assertFileDoesNotExist($storagePath);
    }

    public function test_required_taxonomy_events_are_emitted_by_owner_paths(): void
    {
        $observability = app(PaymentObservabilityService::class);
        foreach (['pending_age', 'reconciliation_failure', 'late_payment', 'duplicate_success', 'refund_ageing', 'amount_mismatch', 'unknown_status', 'needs_review'] as $event) {
            $observability->event($event);
        }
        $this->assertSame(8, count($observability->events()));
    }

    public function test_backfill_dry_run_reports_without_writing(): void
    {
        $order = Order::factory()->create();
        PaymentTransaction::create(['order_id' => $order->id, 'doku_order_id' => 'DRY-1', 'payment_method' => 'qris', 'amount' => 100, 'status' => 'paid']);
        $this->artisan('payments:backfill-attempts --dry-run')->assertExitCode(0);
        $this->assertDatabaseCount('payment_attempts', 0);
    }

    public function test_reconcile_dry_run_reports_without_dispatching(): void
    {
        $order = Order::factory()->create();
        PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'DRY-ATTEMPT', 'invoice_number' => 'DRY-2', 'merchant_request_id' => 'DRY-REQ', 'amount_snapshot' => 100, 'currency_snapshot' => 'IDR', 'creation_state' => 'unknown', 'settlement_status' => 'unknown']);
        Queue::fake();
        $this->artisan('payments:reconcile-doku --dry-run')->assertExitCode(0);
        Queue::assertNothingPushed();
    }

    public function test_required_matrix_categories_are_registered(): void
    {
        $this->assertSame([
            'creation_failed', 'creation_timeout', 'signature_invalid', 'unknown_status', 'amount_mismatch', 'pending_age', 'reconciliation_failure', 'late_payment', 'duplicate_success', 'refund_ageing', 'needs_review', 'invalid_response', 'webhook_rejected', 'transition', 'reconciliation',
        ], PaymentObservabilityService::registeredEventNames());
    }

    public function test_payment_transition_writes_sanitized_structured_observability_event(): void
    {
        Log::shouldReceive('channel')->with('operational')->andReturnSelf();
        Log::shouldReceive('info')->once()->withArgs(function (string $message, array $context): bool {
            return $message === 'payment.transition'
                && isset($context['order_id'], $context['attempt_id'], $context['invoice_number'], $context['request_id'], $context['gateway_reference'], $context['mapped_status'], $context['processing_result'])
                && ! isset($context['raw_body'], $context['signature'], $context['secret_key']);
        });
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'matrix-'.$order->id,
            'invoice_number' => $order->order_code,
            'merchant_request_id' => 'matrix-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
        ]);

        app(DokuService::class)->handleNormalizedWebhook(new NormalizedPaymentEvent(
            source: 'matrix-test',
            gatewayStatus: 'SUCCESS',
            amount: $order->total,
            currency: 'IDR',
            gatewayReference: 'gateway-'.$attempt->id,
            receivedAt: now(),
            rawEvidence: ['order' => ['invoice_number' => $order->order_code]],
        ));

        Log::channel('operational')->shouldHaveReceived('info')->withArgs(function (string $message, array $context): bool {
            return $message === 'payment.transition'
                && isset($context['order_id'], $context['attempt_id'], $context['invoice_number'], $context['request_id'], $context['gateway_reference'], $context['mapped_status'], $context['processing_result'])
                && ! isset($context['raw_body'], $context['signature'], $context['secret_key']);
        });
    }
}
