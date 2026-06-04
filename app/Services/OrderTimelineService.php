<?php

namespace App\Services;

use App\Models\Order;

class OrderTimelineService
{
    private const STEP_LABELS = [
        'pending_confirmation' => 'Pesanan Dibuat',
        'confirmed' => 'Outlet Menerima Pesanan',
        'preparing' => 'Pesanan Sedang Disiapkan',
        'ready_for_pickup' => 'Pesanan Siap',
        'picked_up' => 'Kurir Mengambil Pesanan',
        'delivering' => 'Dalam Perjalanan',
        'completed' => 'Pesanan Selesai',
        'cancelled_by_customer' => 'Dibatalkan Customer',
        'cancelled_by_outlet' => 'Dibatalkan Outlet',
        'rejected_by_outlet' => 'Ditolak Outlet',
        'failed_delivery' => 'Pengiriman Gagal',
        'expired' => 'Konfirmasi Kadaluarsa',
    ];

    public function buildTimeline(Order $order): array
    {
        $histories = $order->statusHistories()->orderBy('created_at')->get();
        $steps = $this->getStepsForOrder($order);

        $historyMap = $histories->keyBy('to_status');

        return array_map(function (string $status) use ($order, $historyMap): array {
            $history = $historyMap->get($status);
            $isCompleted = $this->isStepCompleted($order, $status);
            $isCurrent = $order->status === $status;
            $isTerminal = $this->isTerminalStatus($status) && $isCurrent;

            return [
                'key' => $status,
                'label' => self::STEP_LABELS[$status] ?? $status,
                'is_completed' => $isCompleted,
                'is_current' => $isCurrent,
                'is_terminal' => $isTerminal,
                'timestamp' => $history?->created_at?->toISOString(),
                'notes' => $history?->notes,
                'reason' => $history?->reason,
                'actor_type' => $history?->changed_by_type,
            ];
        }, $steps);
    }

    private function getStepsForOrder(Order $order): array
    {
        $isTerminal = in_array($order->status, [
            'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired',
        ], true);

        if ($isTerminal) {
            return ['pending_confirmation', $order->status];
        }

        if ($order->fulfillment_type === 'pickup') {
            return ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'completed'];
        }

        return ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering', 'completed'];
    }

    private function isStepCompleted(Order $order, string $status): bool
    {
        $statusOrder = array_flip(['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering', 'completed']);
        $currentIndex = $statusOrder[$order->status] ?? -1;
        $stepIndex = $statusOrder[$status] ?? -1;

        if ($currentIndex === -1 || $stepIndex === -1) {
            return false;
        }

        return $stepIndex < $currentIndex;
    }

    private function isTerminalStatus(string $status): bool
    {
        return in_array($status, ['cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'], true);
    }

    public static function stepLabels(): array
    {
        return self::STEP_LABELS;
    }
}
