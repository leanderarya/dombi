<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderStatusService
{
    private const TRANSITIONS = [
        'pending' => ['confirmed', 'cancelled'],
        'confirmed' => ['preparing', 'cancelled'],
        'preparing' => ['ready_for_pickup', 'cancelled'],
        'ready_for_pickup' => ['picked_up', 'cancelled'],
        'picked_up' => ['delivering', 'cancelled'],
        'delivering' => ['completed', 'cancelled'],
        'completed' => [],
        'cancelled' => [],
        'failed' => [],
    ];

    public function __construct(private readonly InventoryService $inventoryService) {}

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

            if ($status === 'cancelled') {
                $this->inventoryService->releaseReservedStock($order);
            }

            $order->update(['status' => $status]);

            $order->statusHistories()->create([
                'from_status' => $fromStatus,
                'to_status' => $status,
                'notes' => $this->statusNote($status),
                'changed_by' => $actor?->id,
                'created_at' => now(),
            ]);

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

    private function statusNote(string $status): string
    {
        return match ($status) {
            'confirmed' => 'Order diterima outlet.',
            'preparing' => 'Order mulai diproses.',
            'ready_for_pickup' => 'Order siap diambil kurir.',
            'cancelled' => 'Order dibatalkan dan reserved stock dilepas.',
            default => 'Status order diperbarui.',
        };
    }
}
