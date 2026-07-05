<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Console\Command;

class ExpirePendingOrders extends Command
{
    protected $signature = 'orders:expire-pending';

    protected $description = 'Expire pending orders: timed-out confirmations and orders with failed/expired payments';

    public function handle(OrderStatusService $orderStatusService): int
    {
        $expiredCount = 0;

        Order::query()
            ->where('status', Order::STATUS_PENDING_CONFIRMATION)
            ->where(function ($query) {
                // Timed out: outlet didn't confirm within 15 minutes
                $query->where(function ($q) {
                    $q->whereNotNull('confirmation_expires_at')
                      ->where('confirmation_expires_at', '<', now());
                })
                // Zombie: payment already failed/expired but order still pending
                ->orWhereIn('payment_status', ['failed', 'expired']);
            })
            ->chunkById(50, function ($orders) use ($orderStatusService, &$expiredCount): void {
                foreach ($orders as $order) {
                    try {
                        $reason = in_array($order->payment_status, ['failed', 'expired'])
                            ? "Payment {$order->payment_status}"
                            : 'Confirmation timeout';
                        $orderStatusService->expireOrder($order, $reason);
                        $expiredCount++;
                    } catch (\Throwable $e) {
                        \Log::error("Failed to expire order {$order->id}: {$e->getMessage()}");
                    }
                }
            });

        if ($expiredCount > 0) {
            $this->info("Expired {$expiredCount} pending orders.");
        }

        return self::SUCCESS;
    }
}
