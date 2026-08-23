<?php

namespace Tests\Feature;

use App\Jobs\ReconcileDokuPayment;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Services\DokuReconciliationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
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

    public function test_doku_5xx_retries_with_backoff(): void
    {
        $attempt = $this->makeAttempt('pending');
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response(null, 500),
        ]);

        $this->reconciliation->reconcile($attempt);

        $attempt->refresh();
        $metadata = $attempt->metadata ?? [];
        $this->assertNotNull($metadata['next_reconciliation_at'] ?? null);
        $this->assertSame('unknown', $attempt->creation_state?->value);
    }

    public function test_timeout_sets_backoff(): void
    {
        $attempt = $this->makeAttempt('pending');
        Http::fake([
            '*/checkout/v1/payment/*' => function () {
                throw new ConnectionException('Connection timed out');
            },
        ]);

        $this->reconciliation->reconcile($attempt);

        $attempt->refresh();
        $metadata = $attempt->metadata ?? [];
        $this->assertNotNull($metadata['next_reconciliation_at'] ?? null);
        $this->assertSame('unknown', $attempt->creation_state?->value);
    }

    public function test_404_terminates_attempt_as_failed(): void
    {
        $attempt = $this->makeAttempt('pending');
        Http::fake([
            '*/checkout/v1/payment/*' => Http::response(null, 404),
        ]);

        $this->reconciliation->reconcile($attempt);

        $attempt->refresh();
        $this->assertSame('failed', $attempt->creation_state?->value);
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