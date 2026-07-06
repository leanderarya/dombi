<?php

namespace App\Console\Commands;

use App\Models\Delivery;
use Illuminate\Console\Command;

class AutoConfirmReturn extends Command
{
    protected $signature = 'deliveries:auto-confirm-return';
    protected $description = 'Auto-confirm returns after 24 hours';

    public function handle(): int
    {
        $staleReturns = Delivery::where('return_status', 'returning_to_outlet')
            ->where('updated_at', '<', now()->subHours(24))
            ->get();

        foreach ($staleReturns as $delivery) {
            $delivery->update([
                'return_status' => 'returned_to_outlet',
                'return_confirmed_at' => now(),
                'return_notes' => 'Auto-confirm setelah 24 jam',
            ]);
        }

        $this->info("Auto-confirmed {$staleReturns->count()} returns.");
        return 0;
    }
}
