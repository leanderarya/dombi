<?php

namespace App\Services;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use Illuminate\Support\Facades\DB;

class OrderPaymentProjectionService
{
    public function __construct(private PaymentStatusService $statuses) {}

    public function recompute(Order $order): string
    {
        return DB::transaction(function () use ($order): string {
            $lockedOrder = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $attempts = PaymentAttempt::query()->where('order_id', $lockedOrder->id)->lockForUpdate()->get();
            $paid = $attempts->contains(fn ($attempt): bool => $attempt->settlement_status === PaymentAttemptSettlementStatus::Paid
                && $attempt->verification_status?->value === 'verified'
            );
            $active = $attempts->contains(fn ($attempt): bool => in_array(
                $attempt->settlement_status?->value,
                ['pending', 'unknown'],
                true
            ) || in_array($attempt->creation_state?->value, ['initiated', 'created'], true));

            $status = $paid
                ? PaymentStatus::Paid
                : ($active ? PaymentStatus::Pending : ($attempts->isNotEmpty() && $attempts->every(fn ($attempt): bool => $attempt->settlement_status?->value === 'expired')
                    ? PaymentStatus::Expired
                    : PaymentStatus::Failed));

            $this->statuses->project($lockedOrder, $status);

            return $status->value;
        });
    }
}
