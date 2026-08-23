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

    public function __construct(public int $eventId, public ?string $claimToken = null) {}

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
            if ($event->claimConsumer()) {
                ($deliver ?? static fn (PaymentOutboxEvent $event): mixed => Event::dispatch($event->event_type, [$event->payload]))($event);
            }
            $event->markDelivered($token);
        } catch (\Throwable $exception) {
            $event->markFailed($token, $exception->getMessage());
        }
    }
}
