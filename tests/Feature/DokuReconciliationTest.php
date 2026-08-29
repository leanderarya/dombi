<?php

namespace Tests\Feature;

use App\Jobs\ReconcileDokuPayment;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Services\CanonicalPaymentTransitionService;
use App\Services\DokuReconciliationService;
use App\Services\DokuService;
use App\Services\DokuWebhookIngressService;
use App\Services\TransitionResult;
use App\Exceptions\DokuPaymentException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schedule;
use Mockery;
use Tests\TestCase;

class DokuReconciliationTest extends TestCase
{
    use RefreshDatabase;

    private DokuReconciliationService $reconciliation;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'doku.client_id' => 'test-client',
            'doku.api_key' => 'test-key',
            'doku.base_url' => 'https://api-sandbox.doku.com',
        ]);
        $this->reconciliation = app(DokuReconciliationService::class);
    }

    private function makeAttempt(string $creationState, array $metadata = []): PaymentAttempt
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);

        return PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'recon-'.$order->id,
            'invoice_number' => $order->order_code,
            'merchant_request_id' => 'recon-req-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'creation_state' => $creationState,
            'metadata' => $metadata,
        ]);
    }

    public function test_pending_attempt_reconciles_to_success(): void
    {
        $attempt = $this->makeAttempt('pending');
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response([
                'order' => ['invoice_number' => $attempt->invoice_number, 'currency' => 'IDR'],
                'transaction' => ['status' => 'SUCCESS', 'amount' => (int) $attempt->amount_snapshot],
            ], 200),
        ]);

        $result = $this->reconciliation->reconcile($attempt);

        $this->assertTrue($result->changed);
        $attempt->refresh();
        $this->assertSame('paid', $attempt->settlement_status?->value);
    }

    public function test_unknown_attempt_reconciles_to_success(): void
    {
        $attempt = $this->makeAttempt('unknown');
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response([
                'order' => ['invoice_number' => $attempt->invoice_number, 'currency' => 'IDR'],
                'transaction' => ['status' => 'SUCCESS', 'amount' => (int) $attempt->amount_snapshot],
            ], 200),
        ]);

        $result = $this->reconciliation->reconcile($attempt);

        $this->assertTrue($result->changed);
        $attempt->refresh();
        $this->assertSame('paid', $attempt->settlement_status?->value);
    }

    public function test_unknown_attempt_gets_24_hour_reconciliation_deadline_when_config_is_null(): void
    {
        config(['order.doku_reconciliation_deadline_hours' => null]);
        $now = now()->startOfSecond();
        $this->travelTo($now);
        $attempt = $this->makeAttempt('unknown');
        Http::fake(['*/checkout/v1/payment/*' => Http::response(null, 500)]);

        $this->reconciliation->reconcile($attempt);

        $metadata = $attempt->fresh()->metadata;
        $this->assertSame($now->copy()->addHours(24)->toIso8601String(), $metadata['reconciliation_deadline_at']);
        $this->assertSame($now->copy()->addMinutes(2)->toIso8601String(), $metadata['next_reconciliation_at']);
        $this->travelBack();
    }

    public function test_creation_failure_initializes_deadline_with_null_runtime_config(): void
    {
        config(['order.doku_reconciliation_deadline_hours' => null]);
        $now = now()->startOfSecond();
        $this->travelTo($now);
        $attempt = $this->makeAttempt('initiated');
        Http::fake(['*/checkout/v1/payment' => Http::response(null, 500)]);

        try {
            app(DokuService::class)->createPayment($attempt);
        } catch (DokuPaymentException) {
            // Expected ambiguous creation failure.
        }

        $this->assertSame($now->copy()->addHours(24)->toIso8601String(), data_get($attempt->fresh()->metadata, 'reconciliation_deadline_at'));
        $this->travelBack();
    }

    public function test_unknown_attempt_initializes_deadline_from_runtime_config(): void
    {
        config(['order.doku_reconciliation_deadline_hours' => 7]);
        $now = now()->startOfSecond();
        $this->travelTo($now);
        $attempt = $this->makeAttempt('unknown');
        Http::fake(['*/checkout/v1/payment/*' => Http::response(null, 500)]);

        $this->reconciliation->reconcile($attempt);

        $this->assertSame($now->copy()->addHours(7)->toIso8601String(), data_get($attempt->fresh()->metadata, 'reconciliation_deadline_at'));
        $this->travelBack();
    }

    public function test_existing_deadline_is_preserved_when_unknown_attempt_is_reconciled(): void
    {
        $deadline = now()->addHours(3)->startOfSecond()->toIso8601String();
        $attempt = $this->makeAttempt('unknown', ['reconciliation_deadline_at' => $deadline]);
        Http::fake(['*/checkout/v1/payment/*' => Http::response(null, 500)]);

        $this->reconciliation->reconcile($attempt);

        $this->assertSame($deadline, data_get($attempt->fresh()->metadata, 'reconciliation_deadline_at'));
    }

    public function test_expiry_sweep_limit_ignores_undated_unknown_attempts(): void
    {
        $undated = $this->makeAttempt('unknown');
        $due = $this->makeAttempt('unknown', ['reconciliation_deadline_at' => now()->subSecond()->toIso8601String()]);

        $this->assertSame(1, $this->reconciliation->expireDueUnknownAttempts(1));
        $this->assertSame('unknown', $undated->fresh()->creation_state?->value);
        $this->assertSame('failed', $due->fresh()->creation_state?->value);
    }

    public function test_expiry_sweep_only_expires_due_unknown_attempts(): void
    {
        $due = $this->makeAttempt('unknown', ['reconciliation_deadline_at' => now()->subSecond()->toIso8601String()]);
        $notDue = $this->makeAttempt('unknown', ['reconciliation_deadline_at' => now()->addHour()->toIso8601String()]);
        $pending = $this->makeAttempt('pending', ['reconciliation_deadline_at' => now()->subSecond()->toIso8601String()]);

        $this->assertSame(1, $this->reconciliation->expireDueUnknownAttempts());
        $this->assertSame('failed', $due->fresh()->creation_state?->value);
        $this->assertSame('unknown', $notDue->fresh()->creation_state?->value);
        $this->assertSame('pending', $pending->fresh()->creation_state?->value);
    }

    public function test_unknown_attempt_past_deadline_fails_and_expires_order(): void
    {
        $attempt = $this->makeAttempt('unknown', ['reconciliation_deadline_at' => now()->subSecond()->toIso8601String()]);

        $this->assertSame(1, $this->reconciliation->expireDueUnknownAttempts());
        $attempt->refresh();

        $this->assertSame('failed', $attempt->creation_state?->value);
        $this->assertSame('failed', $attempt->settlement_status?->value);
        $this->assertSame(Order::STATUS_EXPIRED, $attempt->order->fresh()->status);
    }

    public function test_already_expired_unknown_attempt_is_not_transitioned_again(): void
    {
        $attempt = $this->makeAttempt('unknown', ['reconciliation_deadline_at' => now()->subSecond()->toIso8601String()]);
        $this->assertSame(1, $this->reconciliation->expireDueUnknownAttempts());
        $first = $attempt->fresh()->updated_at->toIso8601String();

        $this->assertSame(0, $this->reconciliation->expireDueUnknownAttempts());
        $this->assertSame($first, $attempt->fresh()->updated_at->toIso8601String());
    }

    public function test_initiated_attempt_skipped(): void
    {
        $attempt = $this->makeAttempt('initiated');

        $result = $this->reconciliation->reconcile($attempt);

        $this->assertFalse($result->changed);
    }

    public function test_created_attempt_skipped(): void
    {
        $attempt = $this->makeAttempt('created');

        $result = $this->reconciliation->reconcile($attempt);

        $this->assertFalse($result->changed);
    }

    public function test_failed_attempt_skipped(): void
    {
        $attempt = $this->makeAttempt('failed');

        $result = $this->reconciliation->reconcile($attempt);

        $this->assertFalse($result->changed);
    }

    public function test_doku_5xx_retries_with_two_minute_backoff_after_first_claim(): void
    {
        $now = now()->startOfSecond();
        $this->travelTo($now);
        $attempt = $this->makeAttempt('pending');
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response(null, 500),
        ]);

        $this->reconciliation->reconcile($attempt);

        $attempt->refresh();
        $metadata = $attempt->metadata ?? [];
        $this->assertSame($now->copy()->addMinutes(2)->toIso8601String(), $metadata['next_reconciliation_at']);
        $this->assertSame(1, $metadata['reconciliation_attempts']);
        $this->assertSame('unknown', $attempt->creation_state?->value);
        $this->travelBack();
    }

    public function test_timeout_sets_two_minute_backoff_after_first_claim(): void
    {
        $now = now()->startOfSecond();
        $this->travelTo($now);
        $attempt = $this->makeAttempt('pending');
        Http::fake([
            '*/checkout/v1/payment/*' => function () {
                throw new ConnectionException('Connection timed out');
            },
        ]);

        $this->reconciliation->reconcile($attempt);

        $attempt->refresh();
        $metadata = $attempt->metadata ?? [];
        $this->assertSame($now->copy()->addMinutes(2)->toIso8601String(), $metadata['next_reconciliation_at']);
        $this->assertSame(1, $metadata['reconciliation_attempts']);
        $this->assertSame('unknown', $attempt->creation_state?->value);
        $this->travelBack();
    }

    public function test_404_preserves_unresolved_state_and_schedules_bounded_retry(): void
    {
        $now = now()->startOfSecond();
        $this->travelTo($now);
        $attempt = $this->makeAttempt('pending');
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response(null, 404),
        ]);

        $result = $this->reconciliation->reconcile($attempt);

        $attempt->refresh();
        $metadata = $attempt->metadata ?? [];
        $this->assertFalse($result->changed);
        $this->assertSame('pending', $attempt->creation_state?->value);
        $this->assertSame(1, $metadata['reconciliation_attempts']);
        $this->assertSame(404, $metadata['last_reconciliation_status']);
        $this->assertSame('invoice_not_found', $metadata['last_reconciliation_error']);
        $this->assertSame($now->copy()->addMinutes(2)->toIso8601String(), $metadata['next_reconciliation_at']);
        $this->assertSame(['reason' => 'invoice_not_found'], $attempt->raw_response);
        $this->travelBack();
    }

    public function test_max_attempts_stops_polling(): void
    {
        $attempt = $this->makeAttempt('pending', ['reconciliation_attempts' => 5]);
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response(null, 500),
        ]);

        $result = $this->reconciliation->reconcile($attempt);

        $this->assertFalse($result->changed);
        $this->assertSame('pending', $attempt->fresh()->creation_state?->value);
    }

    public function test_future_next_reconciliation_at_skips(): void
    {
        $attempt = $this->makeAttempt('pending', [
            'reconciliation_attempts' => 1,
            'next_reconciliation_at' => now()->addHour()->toIso8601String(),
        ]);

        $result = $this->reconciliation->reconcile($attempt);

        $this->assertFalse($result->changed);
    }

    public function test_command_dispatches_jobs_for_pending_and_unknown(): void
    {
        $pending = $this->makeAttempt('pending');
        $unknown = $this->makeAttempt('unknown');
        $this->makeAttempt('pending', ['reconciliation_attempts' => 5]);
        $this->makeAttempt('unknown', ['reconciliation_attempts' => 6]);
        $this->makeAttempt('initiated');
        $this->makeAttempt('created');
        $this->makeAttempt('failed');

        Bus::fake();

        $exit = Artisan::call('payments:reconcile-doku');

        $this->assertSame(0, $exit);
        Bus::assertDispatched(ReconcileDokuPayment::class, fn ($job) => $job->attemptId === $pending->id);
        Bus::assertDispatched(ReconcileDokuPayment::class, fn ($job) => $job->attemptId === $unknown->id);
        Bus::assertDispatchedTimes(ReconcileDokuPayment::class, 3);
    }

    public function test_scheduler_registers_bounded_single_server_reconciliation(): void
    {
        $event = collect(Schedule::events())->first(fn ($event) => str_contains($event->command ?? '', 'payments:reconcile-doku'));

        $this->assertNotNull($event);
        $this->assertTrue($event->withoutOverlapping);
        $this->assertTrue($event->onOneServer);
        $this->assertSame('* * * * *', $event->expression);
    }

    public function test_command_excludes_finalized_settlement_attempts(): void
    {
        $this->makeAttempt('pending', ['reconciliation_attempts' => 0])->update(['settlement_status' => 'paid']);
        $eligible = $this->makeAttempt('pending');
        Bus::fake();

        Artisan::call('payments:reconcile-doku');

        Bus::assertDispatchedTimes(ReconcileDokuPayment::class, 1);
        Bus::assertDispatched(ReconcileDokuPayment::class, fn ($job) => $job->attemptId === $eligible->id);
    }

    public function test_command_dispatches_bounded_batch_only(): void
    {
        config(['doku.reconciliation_batch_limit' => 2]);
        $attempts = collect(range(1, 3))->map(fn () => $this->makeAttempt('pending'));
        Bus::fake();

        Artisan::call('payments:reconcile-doku');

        Bus::assertDispatchedTimes(ReconcileDokuPayment::class, 2);
        Bus::assertDispatched(ReconcileDokuPayment::class, fn ($job) => $job->attemptId === $attempts[0]->id);
        Bus::assertDispatched(ReconcileDokuPayment::class, fn ($job) => $job->attemptId === $attempts[1]->id);
    }

    public function test_job_skips_ineligible_attempt_before_service_call(): void
    {
        $attempt = $this->makeAttempt('failed');
        $service = Mockery::mock(DokuReconciliationService::class);
        $service->shouldNotReceive('reconcile');

        (new ReconcileDokuPayment($attempt->id))->handle($service);

        $this->assertTrue(true);
    }

    public function test_reconciliation_success_uses_canonical_transition_and_normalized_event(): void
    {
        $attempt = $this->makeAttempt('pending');
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response([
                'order' => ['invoice_number' => $attempt->invoice_number, 'currency' => 'IDR'],
                'transaction' => ['status' => 'SUCCESS', 'amount' => (int) $attempt->amount_snapshot],
            ], 200),
        ]);
        $transition = Mockery::mock(CanonicalPaymentTransitionService::class);
        $transition->shouldReceive('apply')
            ->once()
            ->withArgs(fn ($model, $event) => $model->id === $attempt->id
                && $event->source === 'doku-reconciliation'
                && $event->gatewayStatus === 'SUCCESS')
            ->andReturn(new TransitionResult(true, true));
        $this->app->instance(CanonicalPaymentTransitionService::class, $transition);

        app(DokuReconciliationService::class)->reconcile($attempt);
    }

    public function test_command_clamps_oversized_limit_to_configured_maximum(): void
    {
        config(['doku.reconciliation_batch_limit' => 2]);
        collect(range(1, 3))->each(fn () => $this->makeAttempt('pending'));
        Bus::fake();

        $exit = Artisan::call('payments:reconcile-doku', ['--limit' => 99]);

        $this->assertSame(0, $exit);
        Bus::assertDispatchedTimes(ReconcileDokuPayment::class, 2);
    }

    public function test_pending_result_preserves_paid_settlement_and_clears_lease(): void
    {
        $attempt = $this->makeAttempt('pending', ['reconciliation_attempts' => 1]);
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response([
                'order' => ['invoice_number' => $attempt->invoice_number, 'currency' => 'IDR'],
                'transaction' => ['status' => 'PENDING'],
            ], 200),
        ]);
        $attempt->update(['settlement_status' => 'paid']);

        $result = $this->reconciliation->reconcile($attempt);

        $this->assertFalse($result->changed);
        $fresh = $attempt->fresh();
        $this->assertSame('paid', $fresh->settlement_status?->value);
        $this->assertNull(data_get($fresh->metadata, 'reconciliation_lease'));
    }

    public function test_reconciliation_error_preserves_finalized_state_and_clears_lease(): void
    {
        $attempt = $this->makeAttempt('pending', [
            'reconciliation_attempts' => 1,
            'reconciliation_lease' => ['token' => 'claim', 'expires_at' => now()->addMinute()->toIso8601String()],
        ]);
        $attempt->update(['settlement_status' => 'paid']);

        $doku = Mockery::mock(DokuService::class);
        $doku->shouldReceive('reconcilePaymentAttempt')->andThrow(new ModelNotFoundException);
        $service = new DokuReconciliationService($doku);

        $result = $service->reconcile($attempt);

        $this->assertFalse($result->changed);
        $this->assertSame('paid', $attempt->fresh()->settlement_status?->value);
    }

    public function test_reconciliation_claim_skips_finalized_settlement_without_doku_request(): void
    {
        $attempt = $this->makeAttempt('pending');
        $attempt->update(['settlement_status' => 'paid']);
        Http::fake();

        $result = $this->reconciliation->reconcile($attempt);

        $this->assertFalse($result->changed);
        Http::assertNothingSent();
    }

    public function test_reconciliation_deleted_attempt_returns_unchanged_result(): void
    {
        $attempt = $this->makeAttempt('pending');
        $attempt->delete();

        $result = $this->reconciliation->reconcile($attempt);

        $this->assertFalse($result->changed);
    }

    public function test_job_reconciles_single_attempt(): void
    {
        $attempt = $this->makeAttempt('pending');
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response([
                'order' => ['invoice_number' => $attempt->invoice_number, 'currency' => 'IDR'],
                'transaction' => ['status' => 'SUCCESS', 'amount' => (int) $attempt->amount_snapshot],
            ], 200),
        ]);

        (new ReconcileDokuPayment($attempt->id))->handle($this->reconciliation);

        $attempt->refresh();
        $this->assertSame('paid', $attempt->settlement_status?->value);
    }

    public function test_concurrent_webhook_then_reconciliation_is_noop(): void
    {
        $attempt = $this->makeAttempt('pending');
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response([
                'order' => ['invoice_number' => $attempt->invoice_number, 'currency' => 'IDR'],
                'transaction' => ['status' => 'SUCCESS', 'amount' => (int) $attempt->amount_snapshot],
            ], 200),
        ]);

        $this->reconciliation->reconcile($attempt);
        $attempt->refresh();
        $this->assertSame('paid', $attempt->settlement_status?->value);

        $again = $this->reconciliation->reconcile($attempt->fresh());
        $this->assertFalse($again->changed);
    }

    public function test_production_driver_reconciliation_lease_contention_makes_one_status_request(): void
    {
        $available = env('RUN_PRODUCTION_DRIVER_TESTS') === true
            && in_array(config('database.default'), ['mysql', 'pgsql'], true)
            && function_exists('pcntl_fork');
        if (!$available) {
            if (env('CI')) {
                $this->fail('Production-driver race gate required in CI: set RUN_PRODUCTION_DRIVER_TESTS=true with MySQL/PostgreSQL and pcntl.');
            }
            $this->markTestSkipped('Local skip: production race gate unavailable (requires RUN_PRODUCTION_DRIVER_TESTS=true, MySQL/PostgreSQL, pcntl).');
        }

        $attempt = $this->makeAttempt('pending');
        // Forked workers reconnect independently; commit fixture outside RefreshDatabase transaction.
        DB::commit();
        DB::disconnect();
        $requests = tempnam(sys_get_temp_dir(), 'doku-reconcile-');
        $outcomes = tempnam(sys_get_temp_dir(), 'doku-outcomes-');
        Http::fake([
            '*/checkout/v1/payment/*' => function () use ($attempt, $requests) {
                file_put_contents($requests, "request\n", FILE_APPEND | LOCK_EX);
                usleep(100_000);

                return Http::response([
                    'order' => ['invoice_number' => $attempt->invoice_number, 'currency' => 'IDR'],
                    'transaction' => ['status' => 'SUCCESS', 'amount' => (int) $attempt->amount_snapshot],
                ], 200);
            },
        ]);

        $body = json_encode([
            'order' => ['invoice_number' => $attempt->invoice_number, 'amount' => (int) $attempt->amount_snapshot, 'currency' => 'IDR'],
            'transaction' => ['status' => 'SUCCESS', 'amount' => (int) $attempt->amount_snapshot],
        ]);
        $requestId = 'RACE-'.$attempt->id;
        $timestamp = now('UTC')->format('Y-m-d\\TH:i:s\\Z');
        $doku = app(DokuService::class);
        $headers = [
            'Request-Id' => $requestId,
            'Request-Timestamp' => $timestamp,
            'Client-Id' => config('doku.client_id'),
            'Signature' => $doku->signForTest($requestId, $timestamp, '/payment/doku/notify', $body),
        ];

        $children = [];
        for ($worker = 0; $worker < 2; $worker++) {
            $pid = pcntl_fork();
            $this->assertNotSame(-1, $pid);
            if ($pid === 0) {
                DB::disconnect();
                DB::reconnect();
                if ($worker === 0) {
                    $result = app(DokuReconciliationService::class)->reconcile($attempt->fresh());
                    file_put_contents($outcomes, ($result->changed ? 'transition' : 'noop')."\n", FILE_APPEND | LOCK_EX);
                } else {
                    app(DokuWebhookIngressService::class)->receive($body, $headers);
                    // The webhook worker may read a stale pre-lock version while
                    // reconciliation owns the canonical transition. Classify
                    // outcomes from final canonical state, not that stale read.
                    $after = $attempt->fresh();
                    $outcome = (int) $after->status_version === 1 ? 'transition' : 'noop';
                    file_put_contents($outcomes, $outcome."\n", FILE_APPEND | LOCK_EX);
                }
                exit(0);
            }
            $children[] = $pid;
        }
        foreach ($children as $pid) {
            $waited = pcntl_waitpid($pid, $status);
            $this->assertSame($pid, $waited);
            $this->assertTrue(pcntl_wifexited($status));
            $this->assertSame(0, pcntl_wexitstatus($status));
        }

        $this->assertCount(1, file($requests, FILE_IGNORE_NEW_LINES));
        $outcomeLines = file($outcomes, FILE_IGNORE_NEW_LINES);
        $this->assertCount(2, $outcomeLines);
        $this->assertSame(1, count(array_filter($outcomeLines, fn ($outcome) => $outcome === 'transition')));
        $this->assertSame(1, count(array_filter($outcomeLines, fn ($outcome) => $outcome === 'noop')));
        $this->assertSame('paid', $attempt->fresh()->settlement_status?->value);
        unlink($requests);
        unlink($outcomes);
    }

    public function test_command_skips_attempts_with_future_next_reconciliation_at(): void
    {
        $this->makeAttempt('pending', [
            'reconciliation_attempts' => 1,
            'next_reconciliation_at' => now()->addHour()->toIso8601String(),
        ]);
        $eligible = $this->makeAttempt('unknown');

        Bus::fake();

        Artisan::call('payments:reconcile-doku');

        Bus::assertDispatched(ReconcileDokuPayment::class, fn ($job) => $job->attemptId === $eligible->id);
        Bus::assertDispatchedTimes(ReconcileDokuPayment::class, 1);
    }
}
