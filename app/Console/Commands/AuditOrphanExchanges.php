<?php

namespace App\Console\Commands;

use App\Models\ExchangeRequest;
use Illuminate\Console\Command;

class AuditOrphanExchanges extends Command
{
    protected $signature = 'exchange:audit-orphans';

    protected $description = 'Audit ExchangeRequest records without return_request_id for migration planning';

    public function handle(): int
    {
        $orphans = ExchangeRequest::whereNull('return_request_id')->get();
        $grouped = $orphans->groupBy('status');

        $this->info('=== Orphan Exchange Audit (no return_request_id) ===');
        $this->newLine();

        if ($orphans->isEmpty()) {
            $this->info('No orphan exchanges found. Safe to add NOT NULL constraint.');
            return self::SUCCESS;
        }

        $total = $orphans->count();
        $this->warn("Total orphans: {$total}");

        $rows = [];
        foreach (ExchangeRequest::ALL_STATUSES as $status) {
            $count = $grouped->get($status)?->count() ?? 0;
            if ($count > 0) {
                $rows[] = [$status, $count];
            }
        }
        $this->table(['Status', 'Count'], $rows);

        $this->newLine();
        $this->warn('Action needed before migration:');
        $this->line('- submitted/approved/preparing: cancel or create linked return');
        $this->line('- shipped/received: reconcile physical stock first');
        $this->line('- completed: DO NOT modify (already affected settlement)');
        $this->line('- rejected/cancelled: exempt from UNIQUE constraint (NULL allowed)');

        return self::SUCCESS;
    }
}
