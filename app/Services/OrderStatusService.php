<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderStatusService
{
    private const TRANSITIONS = [
        'pending_confirmation' => ['confirmed', 'rejected_by_outlet', 'cancelled_by_customer'],
        'confirmed' => ['preparing', 'cancelled_by_outlet'],
        'preparing' => ['ready_for_pickup', 'cancelled_by_outlet'],
        'ready_for_pickup' => ['picked_up', 'cancelled_by_outlet'],
        'picked_up' => ['delivering'],
        'delivering' => ['completed', 'failed_delivery'],
        'completed' => [],
        'cancelled_by_customer' => [],
        'cancelled_by_outlet' => [],
        'rejected_by_outlet' => [],
        'failed_delivery' => [],
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

    public function __construct(
        private readonly InventoryService $inventoryService,
        private readonly NotificationService $notificationService,
    ) {}

    public function updateStatus(Order $order, string $status, ?User $actor = null): Order
    {
        return DB::transaction(function () use ($order, $status, $actor): Order {
            $order = Order::query()->lockForUpdate()->with('items')->findOrFail($order->id);
            $fromStatus = $order->status;

            if (! $this->canTransition($fromStatus, $status)) {
                throw ValidationException::withMessages([
                    'status' => "Status order tidak bisa diubah dari {$fromStatus} ke {$status}.",
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
                $updateData['cancelled_at'] = now();
                $updateData['cancelled_by'] = $actor?->id;
            }

            $order->update($updateData);

            $order->statusHistories()->create([
                'from_status' => $fromStatus,
                'to_status' => $status,
                'notes' => $this->statusNote($status),
                'changed_by' => $actor?->id,
                'changed_by_type' => $actor?->role ?? 'system',
                'created_at' => now(),
            ]);

            // Fire notifications based on status
            $this->fireStatusNotifications($order, $fromStatus, $status);

            return $order->fresh(['outlet', 'items.product', 'statusHistories.actor']);
        });
    }

    public function rejectOrder(Order $order, string $reason, ?string $note, User $actor): Order
    {
        if (! $order->isPendingConfirmation()) {
            throw ValidationException::withMessages([
                'status' => 'Hanya pesanan yang menunggu konfirmasi yang bisa ditolak.',
            ]);
        }

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
        if (! $order->isPendingConfirmation()) {
            throw ValidationException::withMessages([
                'status' => 'Hanya pesanan yang menunggu konfirmasi yang bisa dibatalkan.',
            ]);
        }

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

        return DB::transaction(function () use ($order, $reason, $note): Order {
            $order = Order::query()->lockForUpdate()->with('items')->findOrFail($order->id);

            if (! $order->isPendingConfirmation()) {
                throw ValidationException::withMessages([
                    'status' => 'Pesanan sudah tidak dalam status menunggu konfirmasi.',
                ]);
            }

            $this->inventoryService->releaseReservedStock($order);

            $order->update([
                'status' => Order::CANCELLED_BY_CUSTOMER,
                'cancelled_at' => now(),
                'cancelled_by' => $order->customer_id,
                'cancellation_reason' => $reason,
                'cancellation_note' => $note,
            ]);

            $order->statusHistories()->create([
                'from_status' => Order::STATUS_PENDING_CONFIRMATION,
                'to_status' => Order::CANCELLED_BY_CUSTOMER,
                'notes' => "Pesanan dibatalkan customer. Alasan: {$reason}",
                'reason' => $reason,
                'changed_by' => $order->customer_id,
                'changed_by_type' => 'customer',
                'created_at' => now(),
            ]);

            $this->notificationService->notifyOrderCancelled($order);

            return $order->fresh(['outlet', 'items.product', 'statusHistories.actor']);
        });
    }

    public function expireOrder(Order $order): Order
    {
        return DB::transaction(function () use ($order): Order {
            $order = Order::query()->lockForUpdate()->with('items')->findOrFail($order->id);

            if (! $order->isPendingConfirmation()) {
                return $order;
            }

            $this->inventoryService->releaseReservedStock($order);

            $order->update([
                'status' => Order::EXPIRED,
                'expired_at' => now(),
                'expired_reason' => 'Confirmation timeout',
            ]);

            $order->statusHistories()->create([
                'from_status' => Order::STATUS_PENDING_CONFIRMATION,
                'to_status' => Order::EXPIRED,
                'notes' => 'Pesanan kadaluarsa. Outlet tidak memberikan konfirmasi dalam batas waktu yang ditentukan.',
                'reason' => 'Confirmation timeout',
                'changed_by' => null,
                'changed_by_type' => 'system',
                'created_at' => now(),
            ]);

            $this->notificationService->notifyOrderExpired($order);

            return $order->fresh(['outlet', 'items.product', 'statusHistories.actor']);
        });
    }

    public function canTransition(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
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

    private function statusNote(string $status): string
    {
        return match ($status) {
            'confirmed' => 'Order diterima outlet.',
            'preparing' => 'Order mulai diproses.',
            'ready_for_pickup' => 'Order siap diambil kurir.',
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
            default => null,
        };
    }
}
