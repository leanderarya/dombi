<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class OrderStatusService
{
    private const TRANSITIONS = [
        'pending_confirmation' => ['confirmed', 'rejected_by_outlet', 'cancelled_by_customer', 'expired'],
        'confirmed' => ['preparing', 'cancelled_by_outlet', 'cancelled_by_customer'],
        'preparing' => ['ready_for_pickup', 'cancelled_by_outlet', 'cancelled_by_customer'],
        'ready_for_pickup' => ['picked_up', 'cancelled_by_outlet'],
        'picked_up' => ['delivering'],
        'delivering' => ['completed', 'failed_delivery'],
        'completed' => [],
        'cancelled_by_customer' => [],
        'cancelled_by_outlet' => [],
        'rejected_by_outlet' => [],
        'failed_delivery' => ['cancelled_by_outlet', 'preparing'],
        'expired' => [],
    ];

    private const REJECTION_REASONS = [
        'Stok Tidak Tersedia',
        'Outlet Tutup',
        'Area Tidak Terjangkau',
        'Gangguan Operasional',
        'Lainnya',
    ];

    private const CANCELLATION_REASONS = [
        'Salah Pesan',
        'Ingin Mengubah Pesanan',
        'Alamat Salah',
        'Tidak Jadi Membeli',
        'Lainnya',
    ];

    private const OUTLET_CANCELLATION_REASONS = [
        'Stok Habis',
        'Produk Rusak',
        'Outlet Tutup',
        'Gangguan Operasional',
        'Lainnya',
    ];

    public function __construct(
        private readonly InventoryService $inventoryService,
        private readonly NotificationService $notificationService,
        private readonly SettlementService $settlementService,
        private readonly SettlementGeneratorService $settlementGeneratorService,
    ) {}

    public function updateStatus(Order $order, string $status, ?User $actor = null, ?string $reason = null): Order
    {
        return DB::transaction(function () use ($order, $status, $actor, $reason): Order {
            $order = Order::query()->lockForUpdate()->with('items')->findOrFail($order->id);
            $fromStatus = $order->status;

            if (! $this->canTransition($fromStatus, $status)) {
                throw ValidationException::withMessages([
                    'status' => "Status order tidak bisa diubah dari {$fromStatus} ke {$status}.",
                ]);
            }

            // Fulfillment-aware guard: prevent pickup orders from entering delivery-only statuses
            if ($order->isPickup() && in_array($status, [
                Order::STATUS_PICKED_UP,
                Order::STATUS_DELIVERING,
            ], true)) {
                throw ValidationException::withMessages([
                    'status' => 'Pesanan pickup tidak dapat masuk ke status pengiriman.',
                ]);
            }

            if (in_array($status, ['cancelled_by_outlet', 'cancelled_by_customer', 'rejected_by_outlet'], true)) {
                $this->inventoryService->releaseReservedStock($order);
            }

            $updateData = ['status' => $status];

            if ($status === 'confirmed') {
                $updateData['confirmed_at'] = now();
                $updateData['confirmed_by'] = $actor?->id;
            }

            if ($status === 'cancelled_by_outlet') {
                if (! $reason || ! in_array($reason, self::OUTLET_CANCELLATION_REASONS, true)) {
                    throw ValidationException::withMessages([
                        'reason' => 'Alasan pembatalan wajib dipilih.',
                    ]);
                }
                $updateData['cancelled_at'] = now();
                $updateData['cancelled_by'] = $actor?->id;
                $updateData['cancellation_reason'] = $reason;
            }

            if ($status === Order::STATUS_COMPLETED) {
                $updateData['completed_at'] = now();
            }

            $order->update($updateData);

            $historyData = [
                'from_status' => $fromStatus,
                'to_status' => $status,
                'notes' => $status === 'cancelled_by_outlet'
                    ? "Order dibatalkan outlet. Alasan: {$reason}"
                    : $this->statusNote($status, $order),
                'changed_by' => $actor?->id,
                'changed_by_type' => $actor?->role ?? 'system',
                'created_at' => now(),
            ];

            if ($status === 'cancelled_by_outlet' && $reason) {
                $historyData['reason'] = $reason;
            }

            $order->statusHistories()->create($historyData);

            // Fire notifications based on status
            $this->fireStatusNotifications($order, $fromStatus, $status);

            // Record settlement payable when order is completed
            if ($status === 'completed') {
                $this->inventoryService->completeOrderStock($order);
                $this->settlementService->recordSale($order);
                // Generate or update weekly settlement for this outlet
                if ($order->outlet_id) {
                    $outlet = Outlet::find($order->outlet_id);
                    if ($outlet) {
                        $this->settlementGeneratorService->generateForOutlet($outlet, now());
                    }
                }
            }

            return $order->fresh(['outlet', 'items.product', 'statusHistories.actor']);
        });
    }

    public function rejectOrder(Order $order, string $reason, ?string $note, User $actor): Order
    {
        if (! in_array($reason, self::REJECTION_REASONS, true)) {
            throw ValidationException::withMessages([
                'reason' => 'Alasan penolakan tidak valid.',
            ]);
        }

        if ($reason === 'Lainnya' && empty($note)) {
            throw ValidationException::withMessages([
                'note' => 'Catatan wajib diisi jika memilih "Lainnya".',
            ]);
        }

        return DB::transaction(function () use ($order, $reason, $note, $actor): Order {
            $order = Order::query()->lockForUpdate()->with('items')->findOrFail($order->id);

            if (! $order->isPendingConfirmation()) {
                throw ValidationException::withMessages([
                    'status' => 'Pesanan sudah tidak dalam status menunggu konfirmasi.',
                ]);
            }

            $this->inventoryService->releaseReservedStock($order);

            $order->update([
                'status' => Order::REJECTED,
                'rejected_at' => now(),
                'rejected_by' => $actor->id,
                'rejection_reason' => $reason,
                'rejection_note' => $note,
            ]);

            $order->statusHistories()->create([
                'from_status' => Order::STATUS_PENDING_CONFIRMATION,
                'to_status' => Order::REJECTED,
                'notes' => "Pesanan ditolak outlet. Alasan: {$reason}",
                'reason' => $reason,
                'changed_by' => $actor->id,
                'changed_by_type' => 'outlet',
                'created_at' => now(),
            ]);

            $this->notificationService->notifyOrderRejected($order, $reason);

            return $order->fresh(['outlet', 'items.product', 'statusHistories.actor']);
        });
    }

    public function cancelByCustomer(Order $order, string $reason, ?string $note): Order
    {
        if (! in_array($reason, self::CANCELLATION_REASONS, true)) {
            throw ValidationException::withMessages([
                'reason' => 'Alasan pembatalan tidak valid.',
            ]);
        }

        if ($reason === 'Lainnya' && empty($note)) {
            throw ValidationException::withMessages([
                'note' => 'Catatan wajib diisi jika memilih "Lainnya".',
            ]);
        }

        try {
            return $this->transition($order, 'cancelled_by_customer', [
                'reason' => $reason,
                'note' => $note,
                'actor_id' => $order->customer_id,
                'actor_type' => 'customer',
                'notes' => "Pesanan dibatalkan customer. Alasan: {$reason}",
            ]);
        } catch (\App\Exceptions\InvalidOrderTransitionException $e) {
            throw ValidationException::withMessages([
                'status' => 'Pesanan tidak dapat dibatalkan pada status ini.',
            ]);
        }
    }

    public function completePickup(Order $order, User $user): Order
    {
        if ($order->fulfillment_type !== 'pickup') {
            throw ValidationException::withMessages([
                'fulfillment_type' => 'Hanya pesanan pickup yang bisa diselesaikan dengan cara ini.',
            ]);
        }

        if ($order->status !== Order::STATUS_READY_FOR_PICKUP) {
            throw ValidationException::withMessages([
                'status' => 'Pesanan harus dalam status siap diambil.',
            ]);
        }

        return DB::transaction(function () use ($order, $user): Order {
            $order = Order::query()->lockForUpdate()->with('items')->findOrFail($order->id);
            $fromStatus = $order->status;

            $order->update([
                'status' => Order::STATUS_COMPLETED,
                'completed_at' => now(),
            ]);

            $order->statusHistories()->create([
                'from_status' => $fromStatus,
                'to_status' => Order::STATUS_COMPLETED,
                'notes' => 'Pesanan diambil customer',
                'changed_by' => $user->id,
                'changed_by_type' => $user->role ?? 'outlet',
                'created_at' => now(),
            ]);

            $this->inventoryService->completeOrderStock($order);
            $this->settlementService->recordSale($order);
            if ($order->outlet_id) {
                $outlet = Outlet::find($order->outlet_id);
                if ($outlet) {
                    $this->settlementGeneratorService->generateForOutlet($outlet, now());
                }
            }

            return $order->fresh(['outlet', 'items.product', 'statusHistories.actor']);
        });
    }

    public function expireOrder(Order $order, string $reason = 'Confirmation timeout'): Order
    {
        return $this->transition($order, 'expired', [
            'reason' => $reason,
            'actor_type' => 'system',
            'notes' => $reason === 'Confirmation timeout'
                ? 'Pesanan kadaluarsa. Outlet tidak memberikan konfirmasi dalam batas waktu yang ditentukan.'
                : "Pesanan kadaluarsa. {$reason}.",
        ]);
    }

    public function canTransition(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    /**
     * Unified entry point for all order status changes.
     * Validates transition, updates status, handles side effects, creates history.
     */
    public function transition(Order $order, string $newStatus, array $context = []): Order
    {
        return DB::transaction(function () use ($order, $newStatus, $context): Order {
            $order = Order::query()->lockForUpdate()->with('items')->findOrFail($order->id);
            $fromStatus = $order->status;

            if (! $this->canTransition($fromStatus, $newStatus)) {
                throw new \App\Exceptions\InvalidOrderTransitionException($fromStatus, $newStatus);
            }

            // Fulfillment-aware guard
            if ($order->isPickup() && in_array($newStatus, [
                Order::STATUS_PICKED_UP,
                Order::STATUS_DELIVERING,
            ], true)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'status' => 'Pesanan pickup tidak dapat masuk ke status pengiriman.',
                ]);
            }

            // Build update data
            $updateData = ['status' => $newStatus];

            if ($newStatus === 'confirmed') {
                $updateData['confirmed_at'] = now();
                $updateData['confirmed_by'] = $context['actor_id'] ?? null;
            }

            if ($newStatus === 'cancelled_by_outlet') {
                $updateData['cancelled_at'] = now();
                $updateData['cancelled_by'] = $context['actor_id'] ?? null;
                $updateData['cancellation_reason'] = $context['reason'] ?? 'System';
            }

            if ($newStatus === 'cancelled_by_customer') {
                $updateData['cancelled_at'] = now();
                $updateData['cancelled_by'] = $order->customer_id;
                $updateData['cancellation_reason'] = $context['reason'] ?? 'Customer cancelled';
                $updateData['cancellation_note'] = $context['note'] ?? null;
            }

            if ($newStatus === 'expired') {
                $updateData['expired_at'] = now();
                $updateData['expired_reason'] = $context['reason'] ?? 'Confirmation timeout';
            }

            if ($newStatus === Order::STATUS_COMPLETED) {
                $updateData['completed_at'] = now();
            }

            $order->update($updateData);

            // Side effects
            $this->handleSideEffects($order, $fromStatus, $newStatus, $context);

            // Status history
            $historyData = [
                'from_status' => $fromStatus,
                'to_status' => $newStatus,
                'notes' => $context['notes'] ?? $this->statusNote($newStatus, $order),
                'reason' => $context['reason'] ?? null,
                'changed_by' => $context['actor_id'] ?? null,
                'changed_by_type' => $context['actor_type'] ?? 'system',
                'created_at' => now(),
            ];

            $order->statusHistories()->create($historyData);

            // Notifications
            $this->fireStatusNotifications($order, $fromStatus, $newStatus);

            return $order->fresh(['outlet', 'items.product', 'statusHistories.actor']);
        });
    }

    /**
     * Handle side effects for status transitions (stock, credit, settlement).
     */
    private function handleSideEffects(Order $order, string $from, string $to, array $ctx): void
    {
        // Stock release on cancellation/expiration/rejection
        if (in_array($to, ['cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'expired', 'failed_delivery'], true)) {
            $this->inventoryService->releaseReservedStock($order);
        }

        // Refund on cancellation/expiration/rejection (if paid via DOKU)
        if (in_array($to, ['cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'expired'], true)) {
            if ($order->payment_status === 'paid') {
                $this->processRefund($order, $to);
            }
        }

        // Settlement on completion
        if ($to === Order::STATUS_COMPLETED) {
            $this->inventoryService->completeOrderStock($order);
            $this->settlementService->recordSale($order);
            if ($order->outlet_id) {
                $outlet = Outlet::find($order->outlet_id);
                if ($outlet) {
                    $this->settlementGeneratorService->generateForOutlet($outlet, now());
                }
            }
        }
    }

    private function processRefund(Order $order, string $reason): void
    {
        if (in_array($order->payment_status, ['refunded', 'refund_failed'], true)) {
            return;
        }

        try {
            $result = app(DokuService::class)->refund($order, $reason);

            if ($result['status'] === 'failed') {
                Log::warning('Refund failed, queued for manual review', [
                    'order_id' => $order->id,
                    'error' => $result['error'] ?? 'Unknown',
                ]);
            } elseif ($result['status'] === 'success') {
                app(NotificationService::class)->notifyRefundProcessed($order, (float) $order->total);
            }
        } catch (\Exception $e) {
            Log::error('Refund exception', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            $order->update([
                'payment_status' => 'refund_failed',
                'refund_reason' => $e->getMessage(),
            ]);
        }
    }

    public static function validStatuses(): array
    {
        return array_keys(self::TRANSITIONS);
    }

    public static function rejectionReasons(): array
    {
        return self::REJECTION_REASONS;
    }

    public static function cancellationReasons(): array
    {
        return self::CANCELLATION_REASONS;
    }

    public static function outletCancellationReasons(): array
    {
        return self::OUTLET_CANCELLATION_REASONS;
    }

    private function statusNote(string $status, ?Order $order = null): string
    {
        return match ($status) {
            'confirmed' => 'Order diterima outlet.',
            'preparing' => 'Order mulai diproses.',
            'ready_for_pickup' => $order && $order->isPickup()
                ? 'Pesanan siap diambil customer'
                : 'Order siap diambil kurir.',
            'picked_up' => 'Order sudah diambil kurir.',
            'delivering' => 'Order sedang diantar.',
            'completed' => 'Order selesai dikirim.',
            'failed_delivery' => 'Pengiriman gagal.',
            'cancelled_by_outlet' => 'Order dibatalkan outlet dan reserved stock dilepas.',
            'rejected_by_outlet' => 'Pesanan ditolak outlet.',
            'cancelled_by_customer' => 'Pesanan dibatalkan customer.',
            'expired' => 'Pesanan kadaluarsa.',
            default => 'Status order diperbarui.',
        };
    }

    private function fireStatusNotifications(Order $order, string $fromStatus, string $toStatus): void
    {
        match ($toStatus) {
            'confirmed' => $this->notificationService->notifyOrderConfirmed($order),
            'rejected_by_outlet' => $this->notificationService->notifyOrderRejected($order, $order->rejection_reason ?? 'Ditolak outlet'),
            'cancelled_by_customer', 'cancelled_by_outlet' => $this->notificationService->notifyOrderCancelled($order),
            'expired' => $this->notificationService->notifyOrderExpired($order),
            default => null,
        };
    }
}
