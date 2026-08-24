<?php

namespace App\Console\Commands;

use App\Services\DokuService;
use Illuminate\Console\Command;

class ExpireUnknownDokuPayments extends Command
{
    protected $signature = 'payments:expire-unknown {--limit=100}';

    protected $description = 'Expire unknown DOKU attempts past reconciliation deadline';

    public function handle(DokuService $doku): int
    {
        $count = $doku->expireDueUnknownAttempts(max(1, (int) $this->option('limit')));
        $this->info("Expired {$count} unknown payment attempt(s).");

        return self::SUCCESS;
    }
}
