<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\User;
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
        return $this->transition($delivery, $courier, 'delivering', 'failed', 'failed', [
            'failed_reason' => $reason,
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
