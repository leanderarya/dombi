<?php

namespace App\Jobs;

use App\Models\PaymentOutboxEvent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Event;

class DispatchPaymentOutboxEvent implements ShouldQueue
{
    use Dispatchable, Queueable;

    public int $tries = 1;

    public function __construct(public int $eventId, public ?string $claimToken = null, public $heartbeat = null) {}

    public function handle(?callable $deliver = null): void
    {
        $event = PaymentOutboxEvent::find($this->eventId);
        if (! $event) {
            return;
        }
        $token = $this->claimToken ?? $event->claim();
        if (! $token) {
            return;
        }

        try {
            if (! $event->ownsClaim($token)) {
                return;
            }
            if ($event->consumerCompleted()) {
                $event->markDelivered($token);

                return;
            }
            $consumerToken = $event->claimConsumer();
            if (! $consumerToken || ! $event->renewClaim($token)) {
                return;
            }
            $event->refresh();
            if (! $event->renewConsumerClaim($consumerToken)) {
                return;
            }
            if ($this->heartbeat !== null && ! ($this->heartbeat)($event, $consumerToken)) {
                return;
            }
            $heartbeat = fn (): bool => $event->renewConsumerClaim($consumerToken) && $event->renewClaim($token);
            if ($this->heartbeat !== null && ! ($this->heartbeat)($event, $consumerToken)) {
                return;
            }
            $startedAt = microtime(true);
            ($deliver ?? static fn (PaymentOutboxEvent $event): mixed => Event::dispatch($event->event_type, [$event->payload]))($event, $heartbeat);
            if (microtime(true) - $startedAt > 240) {
                throw new \RuntimeException('Payment outbox delivery exceeded hard timeout.');
            }
            if (! $event->completeConsumer($consumerToken)) {
                return;
            }
            $event->markDelivered($token);
        } catch (\Throwable $exception) {
            if (isset($consumerToken)) {
                $event->failConsumer($consumerToken, $exception->getMessage());
            }
            $event->markFailed($token, $exception->getMessage());
        }
    }
}
