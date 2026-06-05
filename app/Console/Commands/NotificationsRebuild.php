<?php

namespace App\Console\Commands;

use App\Models\Delivery;
use App\Models\Notification;
use App\Models\Order;
use Illuminate\Console\Command;

class NotificationsRebuild extends Command
{
    protected $signature = 'notifications:rebuild
        {--order= : Rebuild notifications for a specific order ID}
        {--dry-run : Show what would be created without making changes}';

    protected $description = 'Rebuild missing notifications from order and delivery history';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $orderFilter = $this->option('order') ? (int) $this->option('order') : null;
        $created = 0;

        $query = Order::query()
            ->whereIn('status', ['confirmed', 'rejected_by_outlet', 'cancelled_by_customer', 'expired'])
            ->with(['outlet', 'customer']);

        if ($orderFilter) {
            $query->where('id', $orderFilter);
        }

        $orders = $query->get();

        $this->info("Checking {$orders->count()} finalized orders for missing notifications...");

        foreach ($orders as $order) {
            // Check for order.confirmed notification
            if ($order->status === 'confirmed') {
                $exists = Notification::query()
                    ->where('type', 'order.confirmed')
                    ->where('entity_type', 'order')
                    ->where('entity_id', $order->id)
                    ->exists();

                if (! $exists) {
                    $this->line("  Missing: order.confirmed for order #{$order->id} ({$order->order_code})");
                    if (! $dryRun) {
                        $this->createNotification(
                            $order,
                            'order.confirmed',
                            'Pesanan Dikonfirmasi',
                            "Pesanan {$order->order_code} telah diterima outlet.",
                            'order',
                            $order->id,
                        );
                    }
                    $created++;
                }
            }

            // Check for order.rejected notification
            if ($order->status === 'rejected_by_outlet') {
                $exists = Notification::query()
                    ->where('type', 'order.rejected')
                    ->where('entity_type', 'order')
                    ->where('entity_id', $order->id)
                    ->exists();

                if (! $exists) {
                    $this->line("  Missing: order.rejected for order #{$order->id} ({$order->order_code})");
                    if (! $dryRun) {
                        $this->createNotification(
                            $order,
                            'order.rejected',
                            'Pesanan Ditolak',
                            "Pesanan {$order->order_code} ditolak outlet. Alasan: {$order->rejection_reason}",
                            'order',
                            $order->id,
                        );
                    }
                    $created++;
                }
            }

            // Check for order.cancelled notification
            if (in_array($order->status, ['cancelled_by_customer', 'cancelled_by_outlet'])) {
                $exists = Notification::query()
                    ->where('type', 'order.cancelled')
                    ->where('entity_type', 'order')
                    ->where('entity_id', $order->id)
                    ->exists();

                if (! $exists) {
                    $this->line("  Missing: order.cancelled for order #{$order->id} ({$order->order_code})");
                    if (! $dryRun) {
                        $this->createNotification(
                            $order,
                            'order.cancelled',
                            'Pesanan Dibatalkan',
                            "Pesanan {$order->order_code} telah dibatalkan.",
                            'order',
                            $order->id,
                        );
                    }
                    $created++;
                }
            }

            // Check for order.expired notification
            if ($order->status === 'expired') {
                $exists = Notification::query()
                    ->where('type', 'order.expired')
                    ->where('entity_type', 'order')
                    ->where('entity_id', $order->id)
                    ->exists();

                if (! $exists) {
                    $this->line("  Missing: order.expired for order #{$order->id} ({$order->order_code})");
                    if (! $dryRun) {
                        $this->createNotification(
                            $order,
                            'order.expired',
                            'Pesanan Kadaluarsa',
                            "Pesanan {$order->order_code} kadaluarsa karena tidak dikonfirmasi.",
                            'order',
                            $order->id,
                        );
                    }
                    $created++;
                }
            }
        }

        // Check delivery notifications
        $deliveries = Delivery::query()
            ->whereIn('status', ['completed', 'failed'])
            ->with('order')
            ->get();

        $this->info("Checking {$deliveries->count()} finalized deliveries for missing notifications...");

        foreach ($deliveries as $delivery) {
            if ($delivery->status === 'completed') {
                $exists = Notification::query()
                    ->where('type', 'delivery.completed')
                    ->where('entity_type', 'delivery')
                    ->where('entity_id', $delivery->id)
                    ->exists();

                if (! $exists && $delivery->order) {
                    $this->line("  Missing: delivery.completed for delivery #{$delivery->id}");
                    if (! $dryRun) {
                        $this->createNotification(
                            $delivery->order,
                            'delivery.completed',
                            'Pesanan Selesai',
                            "Pesanan {$delivery->order->order_code} telah berhasil dikirim.",
                            'delivery',
                            $delivery->id,
                        );
                    }
                    $created++;
                }
            }
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '') . "Created {$created} notifications.");

        return self::SUCCESS;
    }

    private function createNotification(
        Order $order,
        string $type,
        string $title,
        string $message,
        string $entityType,
        int $entityId,
    ): void {
        Notification::create([
            'customer_id' => $order->customer_id,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => ['order_id' => $order->id],
            'entity_type' => $entityType,
            'entity_id' => $entityId,
        ]);
    }
}
