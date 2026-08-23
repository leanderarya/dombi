<?php

namespace App\Jobs;

use App\Models\PaymentOutboxEvent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

class DispatchPaymentOutboxEvent implements ShouldQueue
{
    use Dispatchable, Queueable;

    public int $tries = 1;

    public function __construct(public int $eventId) {}

    public function handle(?callable $deliver = null): void
    {
        $event = DB::transaction(function (): ?PaymentOutboxEvent {
            $event = PaymentOutboxEvent::query()->whereKey($this->eventId)->lockForUpdate()->first();
            if (! $event || $event->status === 'delivered' || $event->next_attempt_at?->isFuture()) {
                return null;
            }
            $event->increment('attempts');
            $event->refresh();

            return $event;
        });

        if (! $event) {
            return;
        }

        try {
            ($deliver ?? static fn (PaymentOutboxEvent $event): mixed => Event::dispatch($event->event_type, [$event->payload]))($event);
            $event->update(['status' => 'delivered', 'delivered_at' => now(), 'last_error' => null]);
        } catch (\Throwable $exception) {
            $event->update([
                'status' => 'pending',
                'next_attempt_at' => now()->addMinutes(min(60, 2 ** min($event->attempts, 6))),
                'last_error' => $exception->getMessage(),
            ]);
        }
    }
}
