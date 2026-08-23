<?php

namespace App\Console\Commands;

use App\Jobs\ReconcileDokuPayment;
use App\Models\PaymentAttempt;
use Illuminate\Console\Command;

class ReconcileDokuPayments extends Command
{
    protected $signature = 'payments:reconcile-doku {--limit= : Maximum attempts to dispatch}';

    protected $description = 'Reconcile unresolved DOKU payment attempts';

    public function handle(): int
    {
        $maximum = max(1, (int) config('doku.reconciliation_batch_limit', 100));
        $limit = min((int) ($this->option('limit') ?: $maximum), $maximum);
        if ($limit < 1) {
            $this->error('Reconciliation batch limit must be positive.');

            return self::INVALID;
        }

        $attempts = PaymentAttempt::whereIn('creation_state', ['pending', 'unknown'])
            ->where(function ($q) {
                $q->whereNull('metadata->next_reconciliation_at')
                    ->orWhere('metadata->next_reconciliation_at', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('metadata->reconciliation_attempts')
                    ->orWhere('metadata->reconciliation_attempts', '<', 5);
            })
            ->orderBy('id')
            ->limit($limit)
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
