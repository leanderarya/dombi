<?php

namespace App\Console\Commands;

use App\Jobs\DispatchPaymentOutboxEvent;
use App\Models\PaymentOutboxEvent;
use Illuminate\Console\Command;

class DispatchPaymentOutbox extends Command
{
    protected $signature = 'payments:dispatch-outbox {--limit=100}';

    protected $description = 'Dispatch pending payment outbox events';

    public function handle(): int
    {
        PaymentOutboxEvent::pending()->orderBy('id')->limit(max(1, (int) $this->option('limit')))->pluck('id')
            ->each(fn (int $id) => DispatchPaymentOutboxEvent::dispatch($id));

        return self::SUCCESS;
    }
}
