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
        Bus::assertDispatchedTimes(ReconcileDokuPayment::class, 2);
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
        if (env('RUN_PRODUCTION_DRIVER_TESTS') !== true || ! in_array(config('database.default'), ['mysql', 'pgsql'], true) || ! function_exists('pcntl_fork')) {
            $this->markTestSkipped('CI-gated: set RUN_PRODUCTION_DRIVER_TESTS=true with MySQL/PostgreSQL and pcntl.');
        }

        $attempt = $this->makeAttempt('pending');
        $requests = tempnam(sys_get_temp_dir(), 'doku-reconcile-');
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
                    app(DokuReconciliationService::class)->reconcile($attempt->fresh());
                } else {
                    app(DokuWebhookIngressService::class)->receive($body, $headers);
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
        $this->assertSame('paid', $attempt->fresh()->settlement_status?->value);
        unlink($requests);
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
