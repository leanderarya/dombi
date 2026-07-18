<?php

namespace App\Console\Commands;

use App\Models\RestockRequest;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class RestockCheckStuck extends Command
{
    protected $signature = 'restock:check-stuck {--days=3 : Days after shipped to consider stuck}';

    protected $description = 'Check for shipped restock requests stuck without confirmation';

    public function handle(NotificationService $notificationService): int
    {
        $days = (int) $this->option('days');
        $threshold = now()->subDays($days);

        $stuck = RestockRequest::query()
            ->where('status', 'shipped')
            ->where('shipped_at', '<', $threshold)
            ->with('outlet')
            ->get();

        if ($stuck->isEmpty()) {
            $this->info('No stuck restock requests found.');
            return self::SUCCESS;
        }

        $this->warn("Found {$stuck->count()} stuck restock(s) shipped > {$days} days ago:");

        foreach ($stuck as $req) {
            $this->line("  #{$req->id} {$req->outlet?->name} shipped at {$req->shipped_at}");
            try {
                $notificationService->notifyStuckRestock($req);
            } catch (\Throwable $e) {
                $this->error("  Failed to notify for #{$req->id}: {$e->getMessage()}");
            }
        }

        $this->info("Notified {$stuck->count()} stuck restock(s).");

        return self::SUCCESS;
    }
}
