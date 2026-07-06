<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ExpirePendingOrders extends Command
{
    protected $signature = 'orders:expire-pending';

    protected $description = 'Expire pending orders: timed-out confirmations and orders with failed/expired payments past grace period';

    public function handle(OrderStatusService $orderStatusService): int
    {
        $expiredCount = 0;

        Order::query()
            ->where('status', Order::STATUS_PENDING_CONFIRMATION)
            ->where(function ($query) {
                // Case 1: Confirmation timeout — outlet didn't confirm in time
                $query->where(function ($q) {
                    $q->whereNotNull('confirmation_expires_at')
                        ->where('confirmation_expires_at', '<', now());
                })
                // Case 2: Payment failed/expired — give customer a grace period
                // before expiring. Only expire if confirmation_expires_at has also passed.
                // This allows customer to retry payment within the order's confirmation window.
                    ->orWhere(function ($q) {
                        $q->whereIn('payment_status', ['failed', 'expired'])
                            ->whereNotNull('confirmation_expires_at')
                            ->where('confirmation_expires_at', '<', now());
                    });
            })
            ->chunkById(50, function ($orders) use ($orderStatusService, &$expiredCount): void {
                foreach ($orders as $order) {
                    try {
                        $reason = in_array($order->payment_status, ['failed', 'expired'])
                            ? "Payment {$order->payment_status} (grace period expired)"
                            : 'Confirmation timeout';
                        $orderStatusService->expireOrder($order, $reason);
                        $expiredCount++;
                    } catch (\Throwable $e) {
                        Log::error("Failed to expire order {$order->id}: {$e->getMessage()}");
                    }
                }
            });

        if ($expiredCount > 0) {
            $this->info("Expired {$expiredCount} pending orders.");
        }

        return self::SUCCESS;
    }
}
