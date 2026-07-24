<?php

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Models\Order;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PaymentStatusService
{
    public function transition(Order $order, PaymentStatus $to, array $extra = []): bool
    {
        $current = PaymentStatus::from($order->payment_status ?? 'pending');

        if ($current === $to) {
            return false;
        }

        if ($current->isTerminal()) {
            Log::info('PaymentStatus: terminal status is immutable; transition blocked', [
                'order_id' => $order->id, 'current' => $order->payment_status, 'attempted' => $to->value,
            ]);

            return false;
        }

        if (! $this->isValidTransition($current, $to)) {
            Log::info('PaymentStatus: invalid transition blocked', [
                'order_id' => $order->id, 'current' => $current->value, 'attempted' => $to->value,
            ]);

            return false;
        }

        $updated = Order::where('id', $order->id)
            ->where('payment_status', $order->payment_status)
            ->update(array_merge(['payment_status' => $to->value], $this->normalizeExtra($extra)));

        if ($updated === 0) {
            return false;
        }

        $order->refresh();
        $this->bustCaches($order);

        return true;
    }

    private function normalizeExtra(array $extra): array
    {
        if (isset($extra['paid_at']) && $extra['paid_at'] === null) {
            unset($extra['paid_at']);
        }

        return $extra;
    }

    private function bustCaches(Order $order): void
    {
        Cache::forget("outlet:{$order->outlet_id}:pending_orders");
        Cache::forget('owner:pending_counts');
        Cache::forget('owner:order_stats');
    }

    private const VALID_TRANSITIONS = [
        'pending' => ['paid', 'failed', 'expired'],
        'failed' => ['paid', 'expired'],
        'expired' => ['paid'],
    ];

    private function isValidTransition(PaymentStatus $from, PaymentStatus $to): bool
    {
        return in_array($to->value, self::VALID_TRANSITIONS[$from->value] ?? [], true);
    }
}
