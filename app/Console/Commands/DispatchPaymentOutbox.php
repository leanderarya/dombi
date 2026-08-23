<?php

namespace App\Console\Commands;

use App\Jobs\DispatchPaymentOutboxEvent;
use App\Models\PaymentOutboxEvent;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DispatchPaymentOutbox extends Command
{
    protected $signature = 'payments:dispatch-outbox {--limit=100}';

    protected $description = 'Dispatch pending payment outbox events';

    public function handle(): int
    {
        $limit = min(1000, max(1, (int) $this->option('limit')));
        $ids = DB::transaction(function () use ($limit): array {
            return PaymentOutboxEvent::pending()->orderBy('id')->lockForUpdate()->limit($limit)->get()
                ->map(fn (PaymentOutboxEvent $event): ?array => ($token = $event->claim()) ? [$event->id, $token] : null)
                ->filter()->values()->all();
        });

        $failed = 0;
        foreach ($ids as [$id, $token]) {
            try {
                DispatchPaymentOutboxEvent::dispatch($id, $token);
            } catch (\Throwable $exception) {
                PaymentOutboxEvent::find($id)?->releaseClaim($token, $exception->getMessage());
                $failed++;
                $this->error("Failed to enqueue outbox event {$id}: {$exception->getMessage()}");
            }
        }

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
