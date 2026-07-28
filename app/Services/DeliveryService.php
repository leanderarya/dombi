<?php

namespace App\Services;

use App\Exceptions\DeliveryException;
use App\Models\CourierProfile;
use App\Models\Delivery;
use App\Models\DeliveryResolutionLog;
use App\Models\DeliveryStatusHistory;
use App\Models\Order;
use App\Models\OutletInventory;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\OperationalLog;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeliveryService
{
    public function __construct(
        private readonly OrderStatusService $orderStatusService,
        private readonly InventoryService $inventoryService,
        private readonly NotificationService $notificationService,
    ) {}

    public function assignCourier(
        Order $order,
        ?User $courier,
        User $assignedBy,
        bool $overrideCapacity = false,
        ?string $overrideReason = null,
        ?string $courierType = 'dombi',
        ?string $externalName = null,
        ?string $externalPhone = null,
        ?string $externalPlate = null,
        ?string $externalProvider = null,
        ?string $externalReference = null,
        ?float $courierCost = null,
    ): Delivery {
        if (! $order->isDelivery()) {
            throw ValidationException::withMessages([
                'fulfillment_type' => 'Pesanan pickup tidak memerlukan kurir.',
            ]);
        }

        if ($order->payment_status !== 'paid') {
            throw ValidationException::withMessages([
                'payment_status' => 'Pesanan harus sudah dibayar sebelum kurir dipilih.',
            ]);
        }

        if ($courierType === 'eksternal') {
            return $this->assignEksternal($order, $assignedBy, $externalName, $externalPhone, $externalPlate, $externalProvider, $externalReference, $courierCost);
        }

        if ($order->fulfillment_type === 'delivery_ojol') {
            throw ValidationException::withMessages([
                'courier_id' => 'Pesanan delivery Ojol tidak bisa di-assign ke kurir internal.',
            ]);
        }

        if ($courier === null) {
            throw ValidationException::withMessages([
                'courier_id' => 'Kurir wajib dipilih.',
            ]);
        }

        return DB::transaction(function () use ($order, $courier, $assignedBy, $overrideCapacity, $overrideReason): Delivery {
            $order = Order::query()->lockForUpdate()->with('delivery')->findOrFail($order->id);

            if (! $order->isDelivery()) {
                throw ValidationException::withMessages([
                    'fulfillment_type' => 'Pesanan pickup tidak memerlukan kurir.',
                ]);
            }

            if ($order->payment_status !== 'paid') {
                throw ValidationException::withMessages([
                    'payment_status' => 'Pesanan harus sudah dibayar sebelum kurir dipilih.',
                ]);
            }

            if ($order->fulfillment_type === 'delivery_ojol') {
                throw ValidationException::withMessages([
                    'courier_id' => 'Pesanan delivery Ojol tidak bisa di-assign ke kurir internal.',
                ]);
            }

            $courier = User::query()->whereKey($courier->id)->lockForUpdate()->first();

            if ($courier === null) {
                throw ValidationException::withMessages([
                    'courier_id' => 'Kurir tidak ditemukan.',
                ]);
            }

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

            if (! $courier->is_online) {
                throw ValidationException::withMessages([
                    'courier_id' => 'Kurir sedang offline.',
                ]);
            }

            $this->assertCourierAvailableForOutlet($courier, $order->outlet_id);

            if ($order->delivery && $order->delivery->status !== 'rejected_by_courier') {
                throw ValidationException::withMessages([
                    'courier_id' => 'Order ini sudah memiliki delivery.',
                ]);
            }

            // Delete rejected delivery to allow reassignment
            if ($order->delivery && $order->delivery->status === 'rejected_by_courier') {
                $order->delivery->delete();
            }

            // Assign attempt limit check
            $assignAttempts = Delivery::where('order_id', $order->id)
                ->whereIn('status', ['rejected_by_courier', 'waiting_pickup', 'picked_up', 'delivering'])
                ->count();

            $maxAssignAttempts = config('delivery.max_assign_attempts', 3);
            if ($assignAttempts >= $maxAssignAttempts) {
                throw new DeliveryException(
                    "Batas maksimum percobaan assign kurir ({$maxAssignAttempts}) telah tercapai."
                );
            }

            // Capacity check
            $maxActive = config('delivery.capacity.max_active_deliveries', 3);
            $activeCount = $this->getCourierActiveDeliveryCount($courier);

            if ($activeCount >= $maxActive && ! $overrideCapacity) {
                throw ValidationException::withMessages([
                    'courier_id' => "Kurir sudah memiliki {$activeCount} delivery aktif (maksimal {$maxActive}). Gunakan override untuk memaksa assign.",
                ]);
            }

            $delivery = Delivery::create([
                'order_id' => $order->id,
                'courier_id' => $courier->id,
                'status' => 'waiting_pickup',
                'assigned_by' => $assignedBy->id,
                'assigned_at' => now(),
            ]);

            $courier->recordActivity();

            $reason = 'Kurir di-assign.';
            if ($overrideCapacity) {
                $reason = 'Kurir di-assign dengan override kapasitas. Alasan: '.($overrideReason ?? 'Tidak ada alasan.');
            }

            $this->recordHistory($delivery, null, 'waiting_pickup', $assignedBy, $assignedBy->isOwner() ? 'owner' : 'outlet', $reason);

            $this->notificationService->notifyCourierAssigned($delivery);

            return $delivery->load(['order.outlet', 'order.items.product', 'courier', 'assignedBy']);
        });
    }

    private function assignEksternal(Order $order, User $actor, ?string $externalName, ?string $externalPhone, ?string $externalPlate, ?string $externalProvider, ?string $externalReference, ?float $courierCost): Delivery
    {
        return DB::transaction(function () use ($order, $actor, $externalName, $externalPhone, $externalPlate, $externalProvider, $externalReference, $courierCost): Delivery {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);

            if (! $order->isDelivery()) {
                throw ValidationException::withMessages([
                    'fulfillment_type' => 'Pesanan pickup tidak memerlukan kurir.',
                ]);
            }

            if ($order->payment_status !== 'paid') {
                throw ValidationException::withMessages([
                    'payment_status' => 'Pesanan harus sudah dibayar sebelum kurir dipilih.',
                ]);
            }

            if ($order->status !== 'ready_for_pickup') {
                throw ValidationException::withMessages([
                    'courier_id' => 'Pesanan harus dalam status siap diambil.',
                ]);
            }

            $delivery = Delivery::create([
                'order_id' => $order->id,
                'courier_id' => null,
                'courier_type' => 'eksternal',
                'status' => 'waiting_pickup',
                'external_provider' => $externalProvider,
                'external_reference' => $externalReference,
                'external_courier_name' => $externalName,
                'external_courier_phone' => $externalPhone,
                'external_plate_number' => $externalPlate,
                'courier_cost' => $courierCost,
                'assigned_by' => $actor->id,
                'assigned_at' => now(),
            ]);

            $this->recordHistory($delivery, null, 'waiting_pickup', $actor, $actor->isOwner() ? 'owner' : 'outlet', 'Kurir eksternal (Gojek/Grab) dipilih manual.');

            return $delivery->load(['order.outlet', 'order.items.product', 'assignedBy']);
        });
    }

    public function rejectAssignment(Delivery $delivery, User $courier, string $reason, ?string $note = null): Delivery
    {
        return DB::transaction(function () use ($delivery, $courier, $reason, $note): Delivery {
            $delivery = Delivery::query()->lockForUpdate()->findOrFail($delivery->id);

            if ($delivery->courier_id !== $courier->id) {
                abort(403);
            }

            if ($delivery->status !== 'waiting_pickup') {
                throw ValidationException::withMessages([
                    'status' => 'Hanya delivery yang menunggu pickup yang bisa ditolak.',
                ]);
            }

            $delivery->update([
                'status' => 'rejected_by_courier',
                'rejection_reason' => $reason,
                'rejection_note' => $note,
                'rejected_at' => now(),
            ]);

            $courier->recordActivity();

            $this->recordHistory($delivery, 'waiting_pickup', 'rejected_by_courier', $courier, 'courier', $reason);

            // Return order to ready_for_pickup for reassignment
            $order = $delivery->order;
            $order->update(['status' => 'ready_for_pickup']);
            $order->statusHistories()->create([
                'from_status' => 'ready_for_pickup',
                'to_status' => 'ready_for_pickup',
                'notes' => "Kurir menolak assignment. Alasan: {$reason}",
                'changed_by' => $courier->id,
                'changed_by_type' => 'courier',
                'created_at' => now(),
            ]);

            OperationalLog::deliveryResolved($delivery->id, 'rejected_by_courier', $courier->id);

            $this->notificationService->notifyCourierRejectedAssignment($delivery, $reason);

            return $delivery->fresh();
        });
    }

    public function confirmPickup(Delivery $delivery, User $courier): Delivery
    {
        return DB::transaction(function () use ($delivery, $courier): Delivery {
            $result = $this->transition($delivery, $courier, 'waiting_pickup', 'picked_up', 'picked_up', [
                'pickup_time' => now(),
            ]);

            $courier->recordActivity();
            $this->recordHistory($result, 'waiting_pickup', 'picked_up', $courier, 'courier', 'Kurir mengkonfirmasi pickup.');

            $this->notificationService->notifyCourierPickedUp($result);

            return $result;
        });
    }

    public function startDelivery(Delivery $delivery, User $courier): Delivery
    {
        return DB::transaction(function () use ($delivery, $courier): Delivery {
            $result = $this->transition($delivery, $courier, 'picked_up', 'delivering', 'delivering');

            $courier->recordActivity();
            $this->recordHistory($result, 'picked_up', 'delivering', $courier, 'courier', 'Kurir memulai pengiriman.');

            $this->notificationService->notifyDeliveryOutForDelivery($result);

            return $result;
        });
    }

    public function completeDelivery(Delivery $delivery, User $courier, ?array $payload = []): Delivery
    {
        return DB::transaction(function () use ($delivery, $courier, $payload): Delivery {
            $delivery = $this->transition($delivery, $courier, 'delivering', 'completed', 'completed', [
                'delivered_time' => now(),
                'notes' => $payload['notes'] ?? $delivery->notes,
                'proof_image' => $payload['proof_image'] ?? $delivery->proof_image,
                'delivered_to' => $payload['delivered_to'] ?? $delivery->delivered_to,
                'delivery_note' => $payload['delivery_note'] ?? $delivery->delivery_note,
            ]);

            $courier->recordActivity();
            $this->recordHistory($delivery, 'delivering', 'completed', $courier, 'courier', 'Pengiriman selesai.');

            if ($courier->courierProfile) {
                $courier->courierProfile->incrementDeliveries();
            }

            $this->notificationService->notifyDeliveryCompleted($delivery);

            return $delivery->fresh(['order.outlet', 'order.items.product', 'order.statusHistories.actor', 'courier']);
        });
    }

    public function failDelivery(Delivery $delivery, User $courier, string $reason, ?string $failureNote = null): Delivery
    {
        return DB::transaction(function () use ($delivery, $courier, $reason, $failureNote): Delivery {
            $failedReason = $reason;
            if ($reason === 'Lainnya' && $failureNote) {
                $failedReason = 'Lainnya: '.$failureNote;
            }

            $result = $this->transition($delivery, $courier, 'delivering', 'failed', 'failed_delivery', [
                'failed_reason' => $failedReason,
            ]);

            $courier->recordActivity();
            $this->recordHistory($result, 'delivering', 'failed', $courier, 'courier', $reason);

            OperationalLog::deliveryFailed($result->id, $result->order_id, $courier->id, $reason);

            $this->notificationService->notifyDeliveryFailed($result, $failedReason);

            return $result;
        });
    }

    public function returnToOutlet(Delivery $delivery, User $courier, ?string $note = null): Delivery
    {
        return DB::transaction(function () use ($delivery, $courier, $note): Delivery {
            $delivery = Delivery::query()->lockForUpdate()->findOrFail($delivery->id);

            if ($delivery->courier_id !== $courier->id) {
                abort(403);
            }

            if ($delivery->status !== 'failed') {
                throw ValidationException::withMessages([
                    'status' => 'Hanya delivery gagal yang bisa dikembalikan ke outlet.',
                ]);
            }

            $delivery->update([
                'return_status' => 'returning_to_outlet',
                'return_notes' => $note,
            ]);

            $courier->recordActivity();
            $this->recordHistory($delivery, 'failed', 'returning_to_outlet', $courier, 'courier', $note ?? 'Mengembalikan pesanan ke outlet.');

            $this->notificationService->notifyReturnedToOutlet($delivery);
            $this->notificationService->notifyReturnedDeliveryPending($delivery);

            return $delivery->fresh();
        });
    }

    public function confirmReturn(Delivery $delivery, User $outletUser, ?string $note = null): Delivery
    {
        return DB::transaction(function () use ($delivery, $outletUser, $note): Delivery {
            $delivery = Delivery::query()->lockForUpdate()->with('order.items')->findOrFail($delivery->id);

            if ($delivery->return_status !== 'returning_to_outlet') {
                throw ValidationException::withMessages([
                    'status' => 'Delivery belum dalam status returning_to_outlet.',
                ]);
            }

            $delivery->update([
                'return_status' => 'returned_to_outlet',
                'return_confirmed_by' => $outletUser->id,
                'return_confirmed_at' => now(),
                'return_notes' => $note ?? $delivery->return_notes,
            ]);

            // Audit trail: delivery_returned movement per item
            // Note: current_stock was never decremented (only reserved was released on fail),
            // so before_stock == after_stock. The movement is for audit/history purposes.
            $order = $delivery->order;
            if ($order) {
                foreach ($order->items as $item) {
                    if (! $item->product_id) {
                        continue;
                    }

                    $inventory = OutletInventory::query()
                        ->where('outlet_id', $order->outlet_id)
                        ->where('product_id', $item->product_id)
                        ->first();

                    StockMovement::create([
                        'outlet_id' => $order->outlet_id,
                        'product_id' => $item->product_id,
                        'type' => 'delivery_returned',
                        'quantity' => $item->quantity,
                        'before_stock' => $inventory?->current_stock ?? 0,
                        'after_stock' => $inventory?->current_stock ?? 0,
                        'before_reserved' => $inventory?->reserved_stock ?? 0,
                        'after_reserved' => $inventory?->reserved_stock ?? 0,
                        'reference_type' => Delivery::class,
                        'reference_id' => $delivery->id,
                        'notes' => 'Pengiriman dikembalikan ke outlet untuk Order #'.$order->id,
                        'created_by' => $outletUser->id,
                    ]);
                }
            }

            $this->recordHistory($delivery, 'returning_to_outlet', 'returned_to_outlet', $outletUser, 'outlet', $note ?? 'Outlet mengkonfirmasi penerimaan barang kembali.');

            return $delivery->fresh();
        });
    }

    public function transitionExternal(
        Delivery $delivery,
        User $operator,
        string $targetStatus,
        ?string $reason = null,
    ): Delivery {
        return DB::transaction(function () use ($delivery, $operator, $targetStatus, $reason): Delivery {
            $delivery = Delivery::query()
                ->lockForUpdate()
                ->with('order')
                ->findOrFail($delivery->id);

            if ($delivery->courier_type !== 'eksternal'
                || $operator->outlet?->id !== $delivery->order->outlet_id) {
                abort(403);
            }

            if ($targetStatus === 'returned_to_outlet') {
                if ($delivery->status !== 'failed') {
                    throw ValidationException::withMessages([
                        'status' => 'Hanya delivery gagal yang dapat dikembalikan ke outlet.',
                    ]);
                }

                return $this->resolveFailedDelivery(
                    $delivery,
                    $operator,
                    'returned_to_outlet',
                    $reason,
                );
            }

            $allowed = [
                'waiting_pickup' => ['picked_up'],
                'picked_up' => ['delivering'],
                'delivering' => ['completed', 'failed'],
            ];

            if (! in_array($targetStatus, $allowed[$delivery->status] ?? [], true)) {
                throw ValidationException::withMessages([
                    'status' => "Delivery tidak bisa diubah dari {$delivery->status} ke {$targetStatus}.",
                ]);
            }

            if ($targetStatus === 'failed' && blank($reason)) {
                throw ValidationException::withMessages([
                    'reason' => 'Alasan kegagalan wajib diisi.',
                ]);
            }

            $from = $delivery->status;
            $attributes = ['status' => $targetStatus];
            if ($targetStatus === 'picked_up') {
                $attributes['pickup_time'] = now();
            }
            if ($targetStatus === 'completed') {
                $attributes['delivered_time'] = now();
            }
            if ($targetStatus === 'failed') {
                $attributes['failed_reason'] = $reason;
            }

            $delivery->update($attributes);

            $orderStatus = match ($targetStatus) {
                'picked_up' => Order::STATUS_PICKED_UP,
                'delivering' => Order::STATUS_DELIVERING,
                'completed' => Order::STATUS_COMPLETED,
                'failed' => Order::STATUS_FAILED_DELIVERY,
            };
            $this->orderStatusService->updateStatus(
                $delivery->order,
                $orderStatus,
                $operator,
                $reason,
            );
            $this->recordHistory(
                $delivery,
                $from,
                $targetStatus,
                $operator,
                'outlet',
                $reason,
            );

            return $delivery->fresh(['order', 'statusHistories']);
        });
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

            $this->recordHistory($delivery, 'failed', $resolution, $resolver, $resolver->isOwner() ? 'owner' : 'outlet', $notes ?? "Resolved: {$resolution}");

            // Write resolution audit log before resolution handler (delivery may be deleted for retry)
            $retryCount = DeliveryResolutionLog::where('order_id', $order->id)->count();

            if ($resolution === 'retry_delivery') {
                $maxRetries = config('delivery.max_retry_attempts', 3);
                if ($retryCount >= $maxRetries) {
                    throw new DeliveryException(
                        "Batas maksimum percobaan pengiriman ({$maxRetries}) telah tercapai. Silakan batalkan pesanan."
                    );
                }
            }

            $inventoryEffect = match ($resolution) {
                'retry_delivery' => 'Reserved stock preserved — delivery will be retried',
                'returned_to_outlet' => 'Reserved stock preserved — goods returned to outlet',
                'cancelled_and_released' => 'Reserved stock released — inventory restored',
            };

            DeliveryResolutionLog::create([
                'order_id' => $order->id,
                'delivery_id' => $delivery->id,
                'resolution_type' => $resolution,
                'resolved_by' => $resolver->id,
                'resolution_notes' => $notes ?? '',
                'retry_attempt' => $retryCount + 1,
                'previous_status' => 'failed',
                'new_status' => $resolution,
                'inventory_effect' => $inventoryEffect,
                'created_at' => now(),
            ]);

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
        app(OrderStatusService::class)->transition($order, 'preparing', [
            'reason' => 'returned_to_outlet',
            'actor_id' => $resolver->id,
            'actor_type' => 'system',
            'notes' => 'Barang dikembalikan ke outlet, order bisa diproses ulang.',
        ]);
    }

    private function handleCancelledAndReleased(Order $order, User $resolver): void
    {
        app(OrderStatusService::class)->transition($order, 'cancelled_by_outlet', [
            'reason' => 'delivery_failed',
            'actor_id' => $resolver->id,
            'actor_type' => 'owner',
            'notes' => 'Delivery gagal dan dibatalkan, reserved stock dilepas.',
        ]);
    }

    /**
     * Get the number of active deliveries for a courier.
     */
    public function getCourierActiveDeliveryCount(User $courier): int
    {
        return Delivery::where('courier_id', $courier->id)
            ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->count();
    }

    /**
     * Get all active couriers with their current delivery counts.
     */
    public function getAvailableCouriers(): Collection
    {
        return User::where('role', 'courier')
            ->where('is_active', true)
            ->where('is_online', true)
            ->orderBy('name')
            ->get()
            ->map(function (User $courier): array {
                return [
                    'id' => $courier->id,
                    'name' => $courier->name,
                    'active_deliveries' => $this->getCourierActiveDeliveryCount($courier),
                    'is_online' => $courier->is_online,
                ];
            });
    }

    private function recordHistory(Delivery $delivery, ?string $fromStatus, string $toStatus, ?User $actor = null, ?string $actorType = null, ?string $reason = null): void
    {
        DeliveryStatusHistory::create([
            'delivery_id' => $delivery->id,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'changed_by_type' => $actorType,
            'changed_by_id' => $actor?->id,
            'reason' => $reason,
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

    private function assertCourierAvailableForOutlet(User $courier, int $outletId): void
    {
        $available = CourierProfile::query()
            ->availableForOutlet($outletId)
            ->where('user_id', $courier->id)
            ->exists();

        if (! $available) {
            throw ValidationException::withMessages([
                'courier_id' => 'Kurir tidak tersedia untuk outlet pesanan ini.',
            ]);
        }
    }
}
