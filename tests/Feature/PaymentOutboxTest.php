<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Jobs\DispatchPaymentOutboxEvent;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentOutboxEvent;
use App\Services\CanonicalPaymentTransitionService;
use App\Services\NormalizedPaymentEvent;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

class PaymentOutboxTest extends TestCase
{
    use RefreshDatabase;

    public function test_paid_transition_commits_outbox_before_dispatch_and_retry_is_safe(): void
    {
        Queue::fake();
        [$order, $attempt] = $this->attempt();

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []
        ));

        $outbox = PaymentOutboxEvent::query()->where('event_type', 'payment.paid')->firstOrFail();
        $this->assertSame('pending', $outbox->status);
        Queue::assertPushed(DispatchPaymentOutboxEvent::class, fn ($job) => $job->eventId === $outbox->id);

        Event::fake();
        $job = new DispatchPaymentOutboxEvent($outbox->id);
        $job->handle();
        $job->handle();

        $this->assertSame('delivered', $outbox->fresh()->status);
        $this->assertSame(1, $outbox->fresh()->attempts);
        Event::assertDispatched('payment.paid', 1);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_enqueue_failure_after_commit_leaves_all_outbox_rows_pending(): void
    {
        $dispatcher = Mockery::mock(Dispatcher::class);
        $dispatcher->shouldReceive('dispatch')->andThrow(new \RuntimeException('queue unavailable'));
        $this->app->instance(Dispatcher::class, $dispatcher);
        [$order, $attempt] = $this->attempt();

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []
        ));

        $this->assertGreaterThan(1, PaymentOutboxEvent::count());
        $this->assertSame(0, PaymentOutboxEvent::where('status', 'delivered')->count());
        $this->assertSame(PaymentOutboxEvent::count(), PaymentOutboxEvent::where('status', 'pending')->count());
        $this->assertSame(PaymentOutboxEvent::count(), PaymentOutboxEvent::where('last_error', 'queue unavailable')->count());
        $this->assertSame(PaymentOutboxEvent::count(), PaymentOutboxEvent::whereNotNull('next_attempt_at')->count());
    }

    public function test_refund_obligation_creation_emits_one_outbox_event(): void
    {
        Queue::fake();
        [$order, $attempt] = $this->attempt(['status' => Order::STATUS_CANCELLED_BY_CUSTOMER]);
        $service = app(CanonicalPaymentTransitionService::class);
        $event = new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []);

        $service->apply($attempt, $event);
        $service->apply($attempt->fresh(), new NormalizedPaymentEvent('doku', 'FAILED', 50000, 'IDR', 'invoice-first', now()->addMinute(), []));
        $service->apply($attempt->fresh(), new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now()->addMinutes(2), []));

        $this->assertSame(1, PaymentOutboxEvent::where('event_type', 'refund.obligation_created')->count());
    }

    public function test_stale_outer_worker_aborts_before_consumer_effect_after_reclaim(): void
    {
        $outbox = PaymentOutboxEvent::create(['event_key' => 'outer-token', 'event_type' => 'test', 'aggregate_type' => 'payment_attempt', 'aggregate_id' => 1, 'payload' => []]);
        $oldToken = $outbox->claim();
        $outbox->update(['claim_expires_at' => now()->subSecond()]);
        $newToken = $outbox->fresh()->claim();
        $effects = 0;

        (new DispatchPaymentOutboxEvent($outbox->id, $oldToken))->handle(function () use (&$effects): void {
            $effects++;
        });
        (new DispatchPaymentOutboxEvent($outbox->id, $newToken))->handle(function () use (&$effects): void {
            $effects++;
        });

        $this->assertSame(1, $effects);
        $this->assertSame('delivered', $outbox->fresh()->status);
    }

    public function test_stale_worker_reclaim_delivers_consumer_effect_once(): void
    {
        $outbox = PaymentOutboxEvent::create(['event_key' => 'consumer-once', 'event_type' => 'test', 'aggregate_type' => 'payment_attempt', 'aggregate_id' => 1, 'payload' => []]);
        $first = $outbox->claim();
        $effects = 0;
        $job = new DispatchPaymentOutboxEvent($outbox->id, $first);
        $job->handle(function (): void {
            throw new \RuntimeException('worker crashed after consumer claim');
        });
        $outbox->update(['claim_expires_at' => now()->subSecond(), 'next_attempt_at' => now()->subSecond(), 'consumer_claimed_at' => now()->subMinutes(6), 'consumer_next_attempt_at' => now()->subSecond()]);
        (new DispatchPaymentOutboxEvent($outbox->id))->handle(function () use (&$effects): void {
            $effects++;
        });

        $this->assertSame(1, $effects);
        $this->assertSame('delivered', $outbox->fresh()->status);
        $this->assertSame('completed', $outbox->fresh()->consumer_status);
    }

    public function test_consumer_failure_resets_pending_with_backoff_and_keeps_outbox_pending(): void
    {
        $outbox = PaymentOutboxEvent::create(['event_key' => 'consumer-failure', 'event_type' => 'test', 'aggregate_type' => 'payment_attempt', 'aggregate_id' => 1, 'payload' => []]);
        (new DispatchPaymentOutboxEvent($outbox->id))->handle(static function (): void {
            throw new \RuntimeException('consumer unavailable');
        });

        $fresh = $outbox->fresh();
        $this->assertSame('pending', $fresh->status);
        $this->assertSame('pending', $fresh->consumer_status);
        $this->assertSame('consumer unavailable', $fresh->consumer_last_error);
        $this->assertNotNull($fresh->consumer_next_attempt_at);
        $this->assertNull($fresh->consumer_claim_token);
    }

    public function test_stale_consumer_token_cannot_complete_reclaimed_claim(): void
    {
        $outbox = PaymentOutboxEvent::create(['event_key' => 'consumer-token', 'event_type' => 'test', 'aggregate_type' => 'payment_attempt', 'aggregate_id' => 1, 'payload' => []]);
        $first = $outbox->claimConsumer();
        $outbox->update(['consumer_claimed_at' => now()->subMinutes(6)]);
        $second = $outbox->claimConsumer();

        $this->assertNotSame($first, $second);
        $this->assertFalse($outbox->fresh()->completeConsumer($first));
        $this->assertTrue($outbox->fresh()->completeConsumer($second));
    }

    public function test_failed_dispatch_remains_retryable(): void
    {
        Queue::fake();
        [$order, $attempt] = $this->attempt();
        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []
        ));

        $outbox = PaymentOutboxEvent::query()->firstOrFail();
        $job = new DispatchPaymentOutboxEvent($outbox->id);
        $job->handle(static function (): void {
            throw new \RuntimeException('transport unavailable');
        });

        $fresh = $outbox->fresh();
        $this->assertSame('pending', $fresh->status);
        $this->assertSame(1, $fresh->attempts);
        $this->assertSame('transport unavailable', $fresh->last_error);
        $this->assertNotNull($fresh->next_attempt_at);
        $this->travelTo($fresh->next_attempt_at->copy()->addSecond());
        $job->handle();
        $this->assertSame('delivered', $outbox->fresh()->status);
        $this->travelBack();
    }

    public function test_claim_lease_fences_completion_and_stale_lease_is_reclaimable(): void
    {
        $outbox = PaymentOutboxEvent::create(['event_key' => 'test', 'event_type' => 'test', 'aggregate_type' => 'payment_attempt', 'aggregate_id' => 1, 'payload' => []]);
        $first = $outbox->claim();
        $this->assertNotNull($first);
        $this->assertNull($outbox->fresh()->claim(Str::uuid()->toString()));
        $this->assertFalse($outbox->fresh()->markDelivered(Str::uuid()->toString()));
        $outbox->update(['claim_expires_at' => now()->subSecond()]);
        $second = $outbox->fresh()->claim();
        $this->assertNotNull($second);
        $this->assertTrue($outbox->fresh()->markDelivered($second));
        $this->assertFalse($outbox->fresh()->markDelivered($first));
    }

    public function test_scheduler_claims_bounded_rows_without_duplicate_dispatch(): void
    {
        Queue::fake();
        foreach (range(1, 3) as $id) {
            PaymentOutboxEvent::create(['event_key' => "test-{$id}", 'event_type' => 'test', 'aggregate_type' => 'payment_attempt', 'aggregate_id' => $id, 'payload' => []]);
        }

        $this->artisan('payments:dispatch-outbox', ['--limit' => 2])->assertSuccessful();
        Queue::assertPushed(DispatchPaymentOutboxEvent::class, 2);
        $this->assertSame(2, PaymentOutboxEvent::whereNotNull('claim_token')->count());
    }

    private function attempt(array $order = []): array
    {
        $order = Order::factory()->create($order + ['total' => 50000, 'payment_status' => 'pending']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'first', 'invoice_number' => 'invoice-first',
            'merchant_request_id' => 'request-first', 'amount_snapshot' => 50000, 'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Pending,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);

        return [$order, $attempt];
    }
}
