<?php

namespace App\Console\Commands;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\User;
use App\Services\DeliveryService;
use App\Services\OrderStatusService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ResolveStaleOrders extends Command
{
    protected $signature = 'orders:resolve-stale
        {--preparing-hours=24 : Hours before stale preparing orders are cancelled}
        {--ready-hours=24 : Hours before stale ready_for_pickup orders are cancelled}
        {--failed-days=7 : Days before unresolved failed_deliveries are auto-resolved}
        {--delivering-hours=48 : Hours before stalled deliveries are auto-failed}
        {--dry-run : Show what would be resolved without making changes}';

    protected $description = 'Resolve stuck orders: stale preparing, stale ready_for_pickup, unresolved failed_delivery, stalled delivering';

    public function handle(
        DeliveryService $deliveryService,
        OrderStatusService $orderStatusService,
    ): int {
        $dryRun = $this->option('dry-run');
        $totalResolved = 0;

        // 1. Cancel stale preparing orders
        $preparingHours = (int) $this->option('preparing-hours');
        $stalePreparing = Order::query()
            ->where('status', 'preparing')
            ->where('updated_at', '<', now()->subHours($preparingHours))
            ->get();

        $this->info("Found {$stalePreparing->count()} stale preparing orders (>{$preparingHours}h).");

        foreach ($stalePreparing as $order) {
            if ($dryRun) {
                $this->line("  [DRY RUN] Would cancel order #{$order->id} ({$order->order_code})");
            } else {
                try {
                    $orderStatusService->transition($order, 'cancelled_by_outlet', [
                        'reason' => "Auto-cancelled: stale preparing (>{$preparingHours}h)",
                        'actor_type' => 'system',
                        'notes' => "Auto-cancelled: outlet did not complete preparation within {$preparingHours} hours.",
                    ]);
                    $this->line("  Cancelled order #{$order->id} ({$order->order_code})");
                    $totalResolved++;
                } catch (\Throwable $e) {
                    $this->error("  Failed to cancel order #{$order->id}: {$e->getMessage()}");
                    Log::error("ResolveStaleOrders: failed to cancel preparing order #{$order->id}", ['error' => $e->getMessage()]);
                }
            }
        }

        // 2. Cancel stale ready_for_pickup orders
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
                    $orderStatusService->transition($order, 'cancelled_by_outlet', [
                        'reason' => "Auto-cancelled: stale ready_for_pickup (>{$readyHours}h)",
                        'actor_type' => 'system',
                        'notes' => "Auto-cancelled: no courier assigned within {$readyHours} hours.",
                    ]);
                    $this->line("  Cancelled order #{$order->id} ({$order->order_code})");
                    $totalResolved++;
                } catch (\Throwable $e) {
                    $this->error("  Failed to cancel order #{$order->id}: {$e->getMessage()}");
                    Log::error("ResolveStaleOrders: failed to cancel ready order #{$order->id}", ['error' => $e->getMessage()]);
                }
            }
        }

        // 3. Auto-resolve old failed_deliveries
        $failedDays = (int) $this->option('failed-days');
        $staleFailed = Order::query()
            ->where('status', 'failed_delivery')
            ->where('updated_at', '<', now()->subDays($failedDays))
            ->get();

        $this->info("Found {$staleFailed->count()} unresolved failed_deliveries (>{$failedDays} days).");

        foreach ($staleFailed as $order) {
            if ($dryRun) {
                $this->line("  [DRY RUN] Would resolve order #{$order->id} ({$order->order_code}) to cancelled_by_outlet");
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
                        $orderStatusService->transition($order, 'cancelled_by_outlet', [
                            'reason' => "Auto-resolved: stale failed_delivery (>{$failedDays}d)",
                            'actor_type' => 'system',
                            'notes' => "Auto-resolved: failed delivery unresolved for {$failedDays} days.",
                        ]);
                    }
                    $this->line("  Resolved order #{$order->id} ({$order->order_code})");
                    $totalResolved++;
                } catch (\Throwable $e) {
                    $this->error("  Failed to resolve order #{$order->id}: {$e->getMessage()}");
                    Log::error("ResolveStaleOrders: failed to resolve failed_delivery #{$order->id}", ['error' => $e->getMessage()]);
                }
            }
        }

        // 4. Timeout stalled delivering deliveries
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

                    $order = $delivery->order;
                    if ($order) {
                        $orderStatusService->transition($order, 'failed_delivery', [
                            'reason' => "Auto-failed: delivery stalled (>{$deliveringHours}h)",
                            'actor_type' => 'system',
                            'notes' => "Auto-failed: delivery stalled for {$deliveringHours} hours.",
                        ]);
                    }

                    $this->line("  Failed delivery #{$delivery->id} for order #{$delivery->order_id}");
                    $totalResolved++;
                } catch (\Throwable $e) {
                    $this->error("  Failed to timeout delivery #{$delivery->id}: {$e->getMessage()}");
                    Log::error("ResolveStaleOrders: failed to timeout delivery #{$delivery->id}", ['error' => $e->getMessage()]);
                }
            }
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '')."Resolved {$totalResolved} stale items.");

        return self::SUCCESS;
    }
}
