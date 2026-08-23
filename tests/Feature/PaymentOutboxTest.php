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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
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
    }

    private function attempt(): array
    {
        $order = Order::factory()->create(['total' => 50000, 'payment_status' => 'pending']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'first', 'invoice_number' => 'invoice-first',
            'merchant_request_id' => 'request-first', 'amount_snapshot' => 50000, 'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Pending,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);

        return [$order, $attempt];
    }
}
