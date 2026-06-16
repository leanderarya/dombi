<?php

namespace App\Console\Commands;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\User;
use App\Services\DeliveryService;
use App\Services\InventoryService;
use Illuminate\Console\Command;

class ResolveStaleOrders extends Command
{
    protected $signature = 'orders:resolve-stale
        {--ready-hours=24 : Hours before stale ready_for_pickup orders are cancelled}
        {--failed-days=7 : Days before unresolved failed_deliveries are auto-resolved}
        {--delivering-hours=48 : Hours before stalled deliveries are auto-failed}
        {--dry-run : Show what would be resolved without making changes}';

    protected $description = 'Resolve stuck orders: stale ready_for_pickup, unresolved failed_delivery, stalled delivering';

    public function handle(
        DeliveryService $deliveryService,
        InventoryService $inventoryService,
    ): int {
        $dryRun = $this->option('dry-run');
        $totalResolved = 0;

        // 1. Cancel stale ready_for_pickup orders
        $readyHours = (int) $this->option('ready-hours');
        $staleReady = Order::query()
            ->where('status', 'ready_for_pickup')
            ->where('updated_at', '<', now()->subHours($readyHours))
            ->get();

        $this->info("Found {$staleReady->count()} stale ready_for_pickup orders (>{$readyHours}h).");

        foreach ($staleReady as $order) {
            if ($dryRun) {
                $this->line("  [DRY RUN] Would cancel order #{$order->id} ({$order->order_code})");
            } else {
                try {
                    $order = Order::query()->lockForUpdate()->with('items')->findOrFail($order->id);
                    $inventoryService->releaseReservedStock($order);
                    $order->update([
                        'status' => 'cancelled_by_outlet',
                        'cancelled_at' => now(),
                        'cancellation_reason' => 'Auto-cancelled: stale ready_for_pickup',
                    ]);
                    $order->statusHistories()->create([
                        'from_status' => 'ready_for_pickup',
                        'to_status' => 'cancelled_by_outlet',
                        'notes' => "Auto-cancelled: no courier assigned within {$readyHours} hours.",
                        'changed_by_type' => 'system',
                        'created_at' => now(),
                    ]);
                    $this->line("  Cancelled order #{$order->id} ({$order->order_code})");
                    $totalResolved++;
                } catch (\Throwable $e) {
                    $this->error("  Failed to cancel order #{$order->id}: {$e->getMessage()}");
                    report($e);
                }
            }
        }

        // 2. Auto-resolve old failed_deliveries
        $failedDays = (int) $this->option('failed-days');
        $staleFailed = Order::query()
            ->where('status', 'failed_delivery')
            ->where('updated_at', '<', now()->subDays($failedDays))
            ->get();

        $this->info("Found {$staleFailed->count()} unresolved failed_deliveries (>{$failedDays} days).");

        foreach ($staleFailed as $order) {
            if ($dryRun) {
                $this->line("  [DRY RUN] Would resolve order #{$order->id} ({$order->order_code}) to cancelled_and_released");
            } else {
                try {
                    $delivery = Delivery::where('order_id', $order->id)->first();
                    if ($delivery) {
                        $deliveryService->resolveFailedDelivery(
                            $delivery,
                            auth()->user() ?? User::where('role', 'owner')->first(),
                            'cancelled_and_released',
                            "Auto-resolved after {$failedDays} days without resolution."
                        );
                    } else {
                        // No delivery record — manually cancel the order
                        $order = Order::query()->lockForUpdate()->with('items')->findOrFail($order->id);
                        $inventoryService->releaseReservedStock($order);
                        $order->update([
                            'status' => 'cancelled_by_outlet',
                            'cancelled_at' => now(),
                            'cancellation_reason' => 'Auto-resolved: stale failed_delivery',
                        ]);
                    }
                    $this->line("  Resolved order #{$order->id} ({$order->order_code})");
                    $totalResolved++;
                } catch (\Throwable $e) {
                    $this->error("  Failed to resolve order #{$order->id}: {$e->getMessage()}");
                    report($e);
                }
            }
        }

        // 3. Timeout stalled delivering deliveries
        $deliveringHours = (int) $this->option('delivering-hours');
        $stalledDelivering = Delivery::query()
            ->where('status', 'delivering')
            ->where('updated_at', '<', now()->subHours($deliveringHours))
            ->get();

        $this->info("Found {$stalledDelivering->count()} stalled deliveries (>{$deliveringHours}h).");

        foreach ($stalledDelivering as $delivery) {
            if ($dryRun) {
                $this->line("  [DRY RUN] Would fail delivery #{$delivery->id} for order #{$delivery->order_id}");
            } else {
                try {
                    $delivery = Delivery::query()->lockForUpdate()->findOrFail($delivery->id);
                    $delivery->update([
                        'status' => 'failed',
                        'failed_reason' => "Auto-failed: stalled for {$deliveringHours} hours",
                    ]);
                    $delivery->order()->update(['status' => 'failed_delivery']);
                    $delivery->order->statusHistories()->create([
                        'from_status' => 'delivering',
                        'to_status' => 'failed_delivery',
                        'notes' => "Auto-failed: delivery stalled for {$deliveringHours} hours.",
                        'changed_by_type' => 'system',
                        'created_at' => now(),
                    ]);
                    $this->line("  Failed delivery #{$delivery->id} for order #{$delivery->order_id}");
                    $totalResolved++;
                } catch (\Throwable $e) {
                    $this->error("  Failed to timeout delivery #{$delivery->id}: {$e->getMessage()}");
                    report($e);
                }
            }
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '')."Resolved {$totalResolved} stale items.");

        return self::SUCCESS;
    }
}
