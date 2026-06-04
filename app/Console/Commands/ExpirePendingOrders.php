<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Console\Command;

class ExpirePendingOrders extends Command
{
    protected $signature = 'orders:expire-pending';
    protected $description = 'Expire orders that have passed the confirmation deadline';

    public function handle(OrderStatusService $orderStatusService): int
    {
        $expiredCount = 0;

        Order::query()
            ->where('status', Order::STATUS_PENDING_CONFIRMATION)
            ->whereNotNull('confirmation_expires_at')
            ->where('confirmation_expires_at', '<', now())
            ->chunkById(50, function ($orders) use ($orderStatusService, &$expiredCount): void {
                foreach ($orders as $order) {
                    $orderStatusService->expireOrder($order);
                    $expiredCount++;
                }
            });

        if ($expiredCount > 0) {
            $this->info("Expired {$expiredCount} pending orders.");
        }

        return self::SUCCESS;
    }
}
