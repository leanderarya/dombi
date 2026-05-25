<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\User;
use App\Support\OperationalLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeliveryService
{
    public function __construct(
        private readonly OrderStatusService $orderStatusService,
        private readonly InventoryService $inventoryService,
    ) {}

    public function assignCourier(Order $order, User $courier, User $assignedBy): Delivery
    {
        return DB::transaction(function () use ($order, $courier, $assignedBy): Delivery {
            $order = Order::query()->lockForUpdate()->with('delivery')->findOrFail($order->id);

            if ($order->status !== 'ready_for_pickup') {
                throw ValidationException::withMessages([
                    'courier_id' => 'Kurir hanya bisa di-assign untuk order yang sudah ready for pickup.',
                ]);
            }

            if (! $courier->isCourier() || ! $courier->is_active) {
                throw ValidationException::withMessages([
                    'courier_id' => 'User yang dipilih bukan kurir aktif.',
                ]);
            }

            if ($order->delivery) {
                throw ValidationException::withMessages([
                    'courier_id' => 'Order ini sudah memiliki delivery.',
                ]);
            }

            return Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $courier->id,
                'status' => 'waiting_pickup',
                'assigned_by' => $assignedBy->id,
                'assigned_at' => now(),
            ])->load(['order.outlet', 'order.items.product', 'courier', 'assignedBy']);
        });
    }

    public function confirmPickup(Delivery $delivery, User $courier): Delivery
    {
        return $this->transition($delivery, $courier, 'waiting_pickup', 'picked_up', 'picked_up', [
            'pickup_time' => now(),
        ]);
    }

    public function startDelivery(Delivery $delivery, User $courier): Delivery
    {
        return $this->transition($delivery, $courier, 'picked_up', 'delivering', 'delivering');
    }

    public function completeDelivery(Delivery $delivery, User $courier, ?array $payload = []): Delivery
    {
        return DB::transaction(function () use ($delivery, $courier, $payload): Delivery {
            $delivery = $this->transition($delivery, $courier, 'delivering', 'completed', 'completed', [
                'delivered_time' => now(),
                'notes' => $payload['notes'] ?? $delivery->notes,
                'proof_image' => $payload['proof_image'] ?? $delivery->proof_image,
            ]);

            $this->inventoryService->completeOrderStock($delivery->order);

            return $delivery->fresh(['order.outlet', 'order.items.product', 'order.statusHistories.actor', 'courier']);
        });
    }

    public function failDelivery(Delivery $delivery, User $courier, string $reason): Delivery
    {
        $result = $this->transition($delivery, $courier, 'delivering', 'failed', 'failed', [
            'failed_reason' => $reason,
        ]);

        OperationalLog::deliveryFailed($result->id, $result->order_id, $courier->id, $reason);

        return $result;
    }

    /**
     * Resolve a failed delivery: retry_delivery, returned_to_outlet, or cancelled_and_released.
     */
    public function resolveFailedDelivery(Delivery $delivery, User $resolver, string $resolution, ?string $notes = null): Delivery
    {
        return DB::transaction(function () use ($delivery, $resolver, $resolution, $notes): Delivery {
            $delivery = Delivery::query()->lockForUpdate()->with('order.items')->findOrFail($delivery->id);

            if (! $delivery->canResolveTo($resolution)) {
                throw ValidationException::withMessages([
                    'resolution' => "Delivery tidak bisa diubah dari {$delivery->status} ke {$resolution}.",
                ]);
            }

            $delivery->update([
                'status' => $resolution,
                'resolution_status' => $resolution,
                'resolution_notes' => $notes,
                'resolved_by' => $resolver->id,
                'resolved_at' => now(),
            ]);

            $order = $delivery->order;

            match ($resolution) {
                'retry_delivery' => $this->handleRetryDelivery($order, $resolver),
                'returned_to_outlet' => $this->handleReturnedToOutlet($order, $resolver),
                'cancelled_and_released' => $this->handleCancelledAndReleased($order, $resolver),
            };

            OperationalLog::deliveryResolved($delivery->id, $resolution, $resolver->id);

            // For retry_delivery, the delivery is deleted so we can't fresh() it
            if ($resolution === 'retry_delivery') {
                return $delivery;
            }

            return $delivery->fresh(['order.outlet', 'order.items.product', 'order.statusHistories.actor', 'courier', 'resolvedBy']);
        });
    }

    private function handleRetryDelivery(Order $order, User $resolver): void
    {
        // Reserved stock stays. Order goes back to ready_for_pickup for re-assignment.
        $order = Order::query()->lockForUpdate()->findOrFail($order->id);
        $fromStatus = $order->status;
        $order->update(['status' => 'ready_for_pickup']);
        $order->statusHistories()->create([
            'from_status' => $fromStatus,
            'to_status' => 'ready_for_pickup',
            'notes' => 'Delivery gagal, dijadwalkan ulang.',
            'changed_by' => $resolver->id,
            'created_at' => now(),
        ]);

        // Remove old delivery so a new one can be assigned
        Delivery::where('order_id', $order->id)->where('status', 'retry_delivery')->delete();
    }

    private function handleReturnedToOutlet(Order $order, User $resolver): void
    {
        // Reserved stock stays. Order goes back to preparing for re-processing.
        $order = Order::query()->lockForUpdate()->findOrFail($order->id);
        $fromStatus = $order->status;
        $order->update(['status' => 'preparing']);
        $order->statusHistories()->create([
            'from_status' => $fromStatus,
            'to_status' => 'preparing',
            'notes' => 'Barang dikembalikan ke outlet, order bisa diproses ulang.',
            'changed_by' => $resolver->id,
            'created_at' => now(),
        ]);
    }

    private function handleCancelledAndReleased(Order $order, User $resolver): void
    {
        // Release reserved stock. Order becomes cancelled.
        $order = Order::query()->lockForUpdate()->with('items')->findOrFail($order->id);
        $fromStatus = $order->status;

        $this->inventoryService->releaseReservedStock($order);

        $order->update(['status' => 'cancelled']);
        $order->statusHistories()->create([
            'from_status' => $fromStatus,
            'to_status' => 'cancelled',
            'notes' => 'Delivery gagal dan dibatalkan, reserved stock dilepas.',
            'changed_by' => $resolver->id,
            'created_at' => now(),
        ]);
    }

    private function transition(Delivery $delivery, User $courier, string $fromDeliveryStatus, string $toDeliveryStatus, string $toOrderStatus, array $attributes = []): Delivery
    {
        return DB::transaction(function () use ($delivery, $courier, $fromDeliveryStatus, $toDeliveryStatus, $toOrderStatus, $attributes): Delivery {
            $delivery = Delivery::query()->lockForUpdate()->with('order.items')->findOrFail($delivery->id);

            if ($delivery->courier_id !== $courier->id) {
                abort(403);
            }

            if ($delivery->status !== $fromDeliveryStatus) {
                throw ValidationException::withMessages([
                    'status' => "Delivery tidak bisa diubah dari {$delivery->status} ke {$toDeliveryStatus}.",
                ]);
            }

            $delivery->update([
                ...$attributes,
                'status' => $toDeliveryStatus,
            ]);

            $this->orderStatusService->updateStatus($delivery->order, $toOrderStatus, $courier);

            return $delivery->fresh(['order.outlet', 'order.items.product', 'order.statusHistories.actor', 'courier']);
        });
    }
}
