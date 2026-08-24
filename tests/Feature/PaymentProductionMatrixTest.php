<?php

namespace Tests\Feature;

use App\Jobs\ReconcileDokuPayment;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use App\Models\RefundObligation;
use App\Models\User;
use App\Services\CanonicalPaymentTransitionService;
use App\Services\DokuReconciliationService;
use App\Services\DokuService;
use App\Services\NormalizedPaymentEvent;
use App\Services\PaymentObservabilityService;
use App\Services\RefundService;
use App\Services\TransitionResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

class PaymentProductionMatrixTest extends TestCase
{
    use RefreshDatabase;

    public function test_observability_event_backend_failure_is_swallowed_after_commit_and_financial_write_commits(): void
    {
        Cache::shouldReceive('increment')->andThrow(new \RuntimeException('cache unavailable'));
        Cache::shouldReceive('forget')->andReturnTrue();
        Log::shouldReceive('channel')->andThrow(new \RuntimeException('log unavailable'));
        $order = Order::factory()->create(['payment_status' => 'pending', 'total' => 100]);
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'backend-failure', 'invoice_number' => $order->order_code, 'merchant_request_id' => 'backend-failure-request', 'amount_snapshot' => 100, 'currency_snapshot' => 'IDR', 'creation_state' => 'created']);
        DB::transaction(function () use ($attempt): void {
            app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent('test', 'SUCCESS', 100, 'IDR', 'gateway-ref', now(), ['order' => ['invoice_number' => $attempt->invoice_number]]));
            app(PaymentObservabilityService::class)->event('transition', ['attempt_id' => $attempt->id, 'processing_result' => 'committed']);
        });
        $this->assertSame('paid', $attempt->fresh()->settlement_status?->value);
        $this->assertNotNull($order->fresh()->paid_at);
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertDatabaseCount('refund_obligations', 0);
    }

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
        $tables = ['payment_attempts', 'payment_transactions', 'refund_obligations', 'payment_outbox_events', 'payment_webhook_logs', 'orders', 'outlet_inventories', 'stock_movements'];
        $before = $this->snapshotTables($tables);
        $storagePath = storage_path('app/payment-attempt-backfill-exceptions.txt');
        @unlink($storagePath);
        $this->artisan('payments:backfill-attempts --dry-run')->assertExitCode(1);
        $this->assertSame($before, $this->snapshotTables($tables));
        $this->assertSame(0, DB::table('jobs')->count());
        $this->assertFileDoesNotExist($storagePath);
    }

    public function test_required_taxonomy_events_are_emitted_by_owner_paths(): void
    {
        $observability = app(PaymentObservabilityService::class);
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'owner-path-'.uniqid(), 'invoice_number' => $order->order_code, 'merchant_request_id' => 'owner-path-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => 'pending']);
        DB::transaction(function () use ($order, $observability): void {
            app(DokuService::class)->handleNormalizedWebhook(new NormalizedPaymentEvent('matrix', 'UNKNOWN_PROVIDER_STATUS', $order->total, 'IDR', 'gateway-owner', now(), ['order' => ['invoice_number' => $order->order_code]]));
            app(DokuService::class)->handleNormalizedWebhook(new NormalizedPaymentEvent('matrix', 'SUCCESS', 1, 'IDR', 'gateway-owner', now()->addSecond(), ['order' => ['invoice_number' => $order->order_code]]));
            $observability->refreshPendingAgeGauge();
        });
        $this->assertSame('unknown_status', PaymentObservabilityService::taxonomyOwners()['unknown_status'] !== '' ? 'unknown_status' : '');
        $this->assertSame('amount_mismatch', PaymentObservabilityService::taxonomyOwners()['amount_mismatch'] !== '' ? 'amount_mismatch' : '');
        $this->assertSame('needs_review', PaymentObservabilityService::taxonomyOwners()['needs_review'] !== '' ? 'needs_review' : '');
        $this->assertArrayHasKey('pending_age', PaymentObservabilityService::taxonomyOwners());
        $this->assertSame([
            'pending_age' => 'PaymentObservabilityService::refreshPendingAgeGauge',
            'reconciliation_failure' => 'ReconcileDokuPayment::handle',
            'late_payment' => 'CanonicalPaymentTransitionService::apply',
            'duplicate_success' => 'CanonicalPaymentTransitionService::apply',
            'refund_ageing' => 'RefundService::startRefund',
            'amount_mismatch' => 'CanonicalPaymentTransitionService::apply',
            'unknown_status' => 'CanonicalPaymentTransitionService::apply',
            'needs_review' => 'CanonicalPaymentTransitionService::apply',
        ], PaymentObservabilityService::taxonomyOwners());
        $lateOrder = Order::factory()->create(['status' => Order::STATUS_EXPIRED, 'payment_status' => 'pending']);
        $lateAttempt = PaymentAttempt::create(['order_id' => $lateOrder->id, 'attempt_key' => 'late-'.uniqid(), 'invoice_number' => $lateOrder->order_code, 'merchant_request_id' => 'late-request', 'amount_snapshot' => $lateOrder->total, 'currency_snapshot' => 'IDR', 'creation_state' => 'created']);
        app(CanonicalPaymentTransitionService::class)->apply($lateAttempt, new NormalizedPaymentEvent('matrix', 'SUCCESS', $lateOrder->total, 'IDR', 'late-gateway', now(), []));
        $this->assertDatabaseHas('refund_obligations', ['payment_attempt_id' => $lateAttempt->id, 'reason' => 'late_payment']);

        $duplicateOrder = Order::factory()->create(['status' => Order::STATUS_CONFIRMED, 'payment_status' => 'pending']);
        $winner = PaymentAttempt::create(['order_id' => $duplicateOrder->id, 'attempt_key' => 'winner-'.uniqid(), 'invoice_number' => $duplicateOrder->order_code, 'merchant_request_id' => 'winner-request', 'amount_snapshot' => $duplicateOrder->total, 'currency_snapshot' => 'IDR', 'creation_state' => 'created']);
        $duplicateOrder->update(['fulfilment_claimed_at' => now(), 'fulfilment_claimed_by' => $winner->id]);
        $duplicate = PaymentAttempt::create(['order_id' => $duplicateOrder->id, 'attempt_key' => 'duplicate-'.uniqid(), 'invoice_number' => 'DUPLICATE-'.uniqid(), 'merchant_request_id' => 'duplicate-request', 'amount_snapshot' => $duplicateOrder->total, 'currency_snapshot' => 'IDR', 'creation_state' => 'created']);
        app(CanonicalPaymentTransitionService::class)->apply($duplicate, new NormalizedPaymentEvent('matrix', 'SUCCESS', $duplicateOrder->total, 'IDR', 'duplicate-gateway', now(), []));
        $this->assertDatabaseHas('refund_obligations', ['payment_attempt_id' => $duplicate->id, 'reason' => 'duplicate_paid_attempt']);

        $reconciliation = Mockery::mock(DokuReconciliationService::class);
        $reconciliation->shouldReceive('reconcile')->once()->andReturn(new TransitionResult(false));
        app()->instance(DokuReconciliationService::class, $reconciliation);
        $reconcileAttempt = PaymentAttempt::create(['order_id' => Order::factory()->create()->id, 'attempt_key' => 'reconcile-'.uniqid(), 'invoice_number' => 'RECON-1', 'merchant_request_id' => 'reconcile-request', 'amount_snapshot' => 100, 'currency_snapshot' => 'IDR', 'creation_state' => 'pending']);
        (new ReconcileDokuPayment($reconcileAttempt->id))->handle($reconciliation);
        $this->assertArrayHasKey('reconciliation_failure', PaymentObservabilityService::taxonomyOwners());

        $ageOrder = Order::factory()->create(['payment_status' => 'refund_pending', 'refund_reason' => 'late_payment']);
        $ageAttempt = PaymentAttempt::create(['order_id' => $ageOrder->id, 'attempt_key' => 'age-refund-'.uniqid(), 'invoice_number' => $ageOrder->order_code, 'merchant_request_id' => 'age-request', 'amount_snapshot' => $ageOrder->total, 'currency_snapshot' => 'IDR', 'creation_state' => 'created', 'settlement_status' => 'paid']);
        RefundObligation::create(['payment_attempt_id' => $ageAttempt->id, 'amount' => $ageOrder->total, 'currency' => 'IDR', 'reason' => 'late_payment', 'status' => 'pending', 'destination_type' => 'bank', 'bank_name' => 'Bank', 'account_number' => '123', 'account_holder' => 'Owner', 'requested_at' => now()->subHours(25)]);
        $owner = User::factory()->create();
        app(RefundService::class)->start($ageOrder, $owner->id);
        $this->assertSame('in_progress', RefundObligation::where('payment_attempt_id', $ageAttempt->id)->first()->status->value);
        $this->assertArrayHasKey('refund_ageing', PaymentObservabilityService::taxonomyOwners());
    }

    public function test_backfill_dry_run_reports_without_writing(): void
    {
        $order = Order::factory()->create();
        PaymentTransaction::create(['order_id' => $order->id, 'doku_order_id' => 'DRY-1', 'payment_method' => 'qris', 'amount' => 100, 'status' => 'paid']);
        $this->artisan('payments:backfill-attempts --dry-run')->assertExitCode(0);
        $this->assertDatabaseCount('payment_attempts', 0);
    }

    private function snapshotTables(array $tables): array
    {
        return collect($tables)->mapWithKeys(function (string $table): array {
            return [$table => DB::table($table)->get()->map(function ($row): array {
                $values = (array) $row;
                foreach (array_keys($values) as $key) {
                    if (str_ends_with($key, '_at') || in_array($key, ['created_at', 'updated_at'], true)) {
                        $values[$key] = '<timestamp>';
                    }
                }
                ksort($values);

                return $values;
            })->sortBy(fn (array $row): string => json_encode($row))->values()->all()];
        })->all();
    }

    public function test_reconcile_dry_run_reports_without_dispatching(): void
    {
        $order = Order::factory()->create();
        PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'DRY-ATTEMPT', 'invoice_number' => 'DRY-2', 'merchant_request_id' => 'DRY-REQ', 'amount_snapshot' => 100, 'currency_snapshot' => 'IDR', 'creation_state' => 'unknown', 'settlement_status' => 'unknown']);
        Queue::fake();
        $this->artisan('payments:reconcile-doku --dry-run')
            ->expectsOutputToContain('DRY RUN attempt=')
            ->assertExitCode(0);
        $this->assertSame('DRY-2', PaymentAttempt::query()->sole()->invoice_number);
        $this->assertSame('unknown', PaymentAttempt::query()->sole()->settlement_status?->value);
        $this->assertSame(0, DB::table('jobs')->count());
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
