<?php

namespace App\Console\Commands;

use App\Jobs\ReconcileDokuPayment;
use App\Models\PaymentAttempt;
use Illuminate\Console\Command;

class ReconcileDokuPayments extends Command
{
    protected $signature = 'payments:reconcile-doku';

    protected $description = 'Reconcile unresolved DOKU payment attempts';

    public function handle(): int
    {
        $attempts = PaymentAttempt::whereIn('creation_state', ['pending', 'unknown'])
            ->where(function ($q) {
                $q->whereNull('metadata->next_reconciliation_at')
                    ->orWhere('metadata->next_reconciliation_at', '<=', now());
            })
            ->get();

        if ($attempts->isEmpty()) {
            $this->info('No DOKU payments to reconcile.');

            return self::SUCCESS;
        }

        $this->info("Dispatching reconciliation for {$attempts->count()} attempt(s)...");

        foreach ($attempts as $attempt) {
            ReconcileDokuPayment::dispatch($attempt->id);
        }

        $this->info('Done.');

        return self::SUCCESS;
    }
}