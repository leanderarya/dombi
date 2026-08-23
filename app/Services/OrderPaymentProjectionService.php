<?php

namespace App\Services;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;

class OrderPaymentProjectionService
{
    public function __construct(private PaymentStatusService $statuses) {}

    public function recompute(Order $order): string
    {
        $attempts = $order->paymentAttempts()->get();
        $paid = $attempts->contains(fn ($attempt): bool => $attempt->settlement_status === PaymentAttemptSettlementStatus::Paid
            && $attempt->verification_status?->value === 'verified'
        );
        $active = $attempts->contains(fn ($attempt): bool => in_array(
            $attempt->settlement_status?->value,
            ['pending', 'unknown'],
            true
        ));

        $status = $paid
            ? PaymentStatus::Paid
            : ($active ? PaymentStatus::Pending : ($attempts->isNotEmpty() && $attempts->every(fn ($attempt): bool => $attempt->settlement_status?->value === 'expired')
                ? PaymentStatus::Expired
                : PaymentStatus::Failed));

        $this->statuses->project($order, $status);

        return $status->value;
    }
}
