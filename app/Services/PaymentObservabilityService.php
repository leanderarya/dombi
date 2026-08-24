<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PaymentAttempt;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

final class PaymentObservabilityService
{
    private const LABELS = [
        'order_id', 'attempt_id', 'invoice_number', 'request_id', 'gateway_reference',
        'mapped_status', 'processing_result', 'error_reason',
    ];

    private const EVENTS = [
        'creation_failed', 'creation_timeout', 'signature_invalid', 'unknown_status', 'amount_mismatch', 'pending_age', 'reconciliation_failure', 'late_payment', 'duplicate_success', 'refund_ageing', 'needs_review', 'invalid_response', 'webhook_rejected', 'transition', 'reconciliation',
    ];

    private array $counters = [];

    private array $gauges = ['payment_pending_age_seconds' => 0];

    private array $events = [];

    public static function registeredEventNames(): array
    {
        return self::EVENTS;
    }

    public static function taxonomyOwners(): array
    {
        return [
            'pending_age' => 'PaymentObservabilityService::refreshPendingAgeGauge',
            'reconciliation_failure' => 'ReconcileDokuPayment::handle',
            'late_payment' => 'CanonicalPaymentTransitionService::apply',
            'duplicate_success' => 'CanonicalPaymentTransitionService::apply',
            'refund_ageing' => 'RefundService::startRefund',
            'amount_mismatch' => 'CanonicalPaymentTransitionService::apply',
            'unknown_status' => 'CanonicalPaymentTransitionService::apply',
            'needs_review' => 'CanonicalPaymentTransitionService::apply',
        ];
    }

    public function counters(): array
    {
        return array_merge(Cache::get('payment_observability.counters', []), $this->counters);
    }

    public function gauges(): array
    {
        return array_merge($this->gauges, Cache::get('payment_observability.gauges', []));
    }

    public function events(): array
    {
        return $this->events;
    }

    public function transition(PaymentAttempt $attempt, Order $order, string $status, string $result, ?string $reason = null): void
    {
        $this->event('transition', [
            'order_id' => $order->id,
            'attempt_id' => $attempt->id,
            'invoice_number' => $attempt->invoice_number,
            'request_id' => $attempt->merchant_request_id,
            'gateway_reference' => $attempt->gateway_transaction_id,
            'mapped_status' => $status,
            'processing_result' => $result,
            'error_reason' => $reason,
        ]);
    }

    public function refreshPendingAgeGauge(): void
    {
        $oldest = PaymentAttempt::query()->whereIn('creation_state', ['pending', 'unknown'])->orderBy('created_at')->first();
        $this->gauges['payment_pending_age_seconds'] = $oldest ? max(0, now()->timestamp - $oldest->created_at->timestamp) : 0;
        Cache::forever('payment_observability.gauges', $this->gauges);
        $this->event('pending_age', ['mapped_status' => 'pending', 'processing_result' => 'gauge', 'error_reason' => null]);
    }

    public function event(string $name, array $context = []): void
    {
        if (! in_array($name, self::EVENTS, true)) {
            throw new \InvalidArgumentException('Unregistered payment observability event.');
        }
        $unknown = array_diff(array_keys($context), self::LABELS);
        if ($unknown !== []) {
            throw new \InvalidArgumentException('Unknown payment observability labels: '.implode(', ', $unknown));
        }

        $labels = [];
        foreach (self::LABELS as $label) {
            $labels[$label] = array_key_exists($label, $context) ? $context[$label] : null;
        }
        $event = ['name' => $name, 'labels' => $labels];
        $this->events[] = $event;
        $counter = 'payment_'.$name;
        $this->counters[$counter] = ($this->counters[$counter] ?? 0) + 1;
        $durableCounters = Cache::get('payment_observability.counters', []);
        $durableCounters[$counter] = ($durableCounters[$counter] ?? 0) + 1;
        Cache::forever('payment_observability.counters', $durableCounters);
        Log::channel('operational')->info('payment.'.$name, $labels);
    }
}
