<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class BackfillAwaitingPreparation extends Command
{
    protected $signature = 'orders:backfill-awaiting-preparation
        {--dry-run : Show what would be moved without changing anything}';

    protected $description = 'Move already-paid orders that are still waiting for outlet confirmation into awaiting_preparation';

    public function handle(OrderStatusService $orderStatusService): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $orders = Order::query()
            ->where('status', Order::STATUS_PENDING_CONFIRMATION)
            ->whereIn('payment_status', ['paid', 'settled'])
            ->get();

        $this->info("Found {$orders->count()} paid orders still sitting in pending_confirmation.");

        $moved = 0;

        foreach ($orders as $order) {
            if ($dryRun) {
                $this->line("  [DRY RUN] Would move order #{$order->id} ({$order->order_code})");

                continue;
            }

            try {
                $orderStatusService->transition($order, Order::STATUS_AWAITING_PREPARATION, [
                    'actor_type' => 'system',
                    'notes' => 'Backfill: pembayaran sudah berhasil sebelum alur baru berlaku.',
                ]);
                $this->line("  Moved order #{$order->id} ({$order->order_code})");
                $moved++;
            } catch (\Throwable $e) {
                $this->error("  Failed to move order #{$order->id}: {$e->getMessage()}");
                Log::error("BackfillAwaitingPreparation: failed for order #{$order->id}", ['error' => $e->getMessage()]);
            }
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '')."Moved {$moved} orders.");

        return self::SUCCESS;
    }
}
