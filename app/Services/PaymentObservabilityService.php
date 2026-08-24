<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PaymentAttempt;
use Illuminate\Support\Facades\Log;

final class PaymentObservabilityService
{
    public function transition(PaymentAttempt $attempt, Order $order, string $status, string $result, ?string $reason = null): void
    {
        Log::channel('operational')->info('payment.transition', array_filter([
            'order_id' => $order->id,
            'attempt_id' => $attempt->id,
            'invoice_number' => $attempt->invoice_number,
            'request_id' => $attempt->merchant_request_id,
            'gateway_reference' => $attempt->gateway_transaction_id,
            'mapped_status' => $status,
            'processing_result' => $result,
            'error_reason' => $reason,
        ], static fn ($value): bool => $value !== null));
    }

    public function event(string $metric, array $context = []): void
    {
        Log::channel('operational')->info('payment.'.$metric, $context);
    }
}
