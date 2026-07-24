<?php

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Enums\RefundRejectionReason;
use App\Models\Order;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PaymentStatusService
{
    public function transition(Order $order, PaymentStatus $to, array $extra = []): bool
    {
        $current = PaymentStatus::from($order->payment_status ?? 'pending');

        // Same-status transition is always a no-op (idempotency guard).
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

    public function reopenRefund(Order $order): bool
    {
        $updated = Order::query()
            ->whereKey($order->id)
            ->where('payment_status', PaymentStatus::RefundRejected->value)
            ->whereIn('refund_rejected_reason', [
                RefundRejectionReason::InvalidDestination->value,
                RefundRejectionReason::IncompleteDestination->value,
            ])
            ->update([
                'payment_status' => PaymentStatus::RefundPending->value,
                'refund_rejected_reason' => null,
                'refund_rejection_note' => null,
                'refund_rejected_at' => null,
                'refund_rejected_by' => null,
                'updated_at' => now(),
            ]);

        if ($updated !== 1) {
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

    /**
     * Valid payment_status transitions.
     * States not listed here (Expired, RefundRejected) are immutable.
     */
    private const VALID_TRANSITIONS = [
        'pending' => ['paid', 'failed', 'expired'],
        'paid' => ['refund_pending'],
        'failed' => ['paid', 'expired'],
        'refund_pending' => ['refund_in_progress', 'refund_rejected'],
        'refund_in_progress' => ['refunded'],
    ];

    private function isValidTransition(PaymentStatus $from, PaymentStatus $to): bool
    {
        return in_array($to->value, self::VALID_TRANSITIONS[$from->value] ?? [], true);
    }
}
