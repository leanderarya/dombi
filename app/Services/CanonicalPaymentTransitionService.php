<?php

namespace App\Services;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Enums\RefundObligationStatus;
use App\Jobs\DispatchPaymentOutboxEvent;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentOutboxEvent;
use App\Models\RefundObligation;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class CanonicalPaymentTransitionService
{
    public function apply(PaymentAttempt $attempt, NormalizedPaymentEvent $event): TransitionResult
    {
        return DB::transaction(function () use ($attempt, $event): TransitionResult {
            $order = Order::query()->whereKey($attempt->order_id)->lockForUpdate()->firstOrFail();
            $lockedAttempt = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            $lastReceivedAt = data_get($lockedAttempt->metadata ?? [], 'last_event_received_at');
            if ($lastReceivedAt !== null && $event->receivedAt->lessThanOrEqualTo(Carbon::parse($lastReceivedAt)->utc())) {
                return new TransitionResult(false, $lockedAttempt->fulfilment_claimed_at !== null);
            }
            $invoice = data_get($event->rawEvidence, 'order.invoice_number') ?? $lockedAttempt->invoice_number;
            $this->validateInvoice($lockedAttempt, $invoice);
            $event = $event->withGatewayReference($this->normalizeReference($lockedAttempt, $event));
            $this->validate($lockedAttempt, $event);

            $status = strtolower($event->gatewayStatus);
            $status = $status === 'paid' ? 'success' : $status;
            $oldSettlement = $lockedAttempt->settlement_status;
            $changed = false;
            $needsReview = false;

            if ($status === 'success') {
                $needsReview = ! $this->amountMatches($lockedAttempt, $event);
                if ($oldSettlement !== PaymentAttemptSettlementStatus::Paid) {
                    $lockedAttempt->settlement_status = PaymentAttemptSettlementStatus::Paid;
                    $changed = true;
                }
                if ($lockedAttempt->verification_status !== PaymentAttemptVerificationStatus::Verified && ! $needsReview
                    && ! data_get($lockedAttempt->metadata, 'legacy_webhook_needs_review')) {
                    $lockedAttempt->verification_status = PaymentAttemptVerificationStatus::Verified;
                    $changed = true;
                }
                if ($needsReview && $lockedAttempt->verification_status !== PaymentAttemptVerificationStatus::Verified
                    && $lockedAttempt->verification_status !== PaymentAttemptVerificationStatus::NeedsReview) {
                    $lockedAttempt->verification_status = PaymentAttemptVerificationStatus::NeedsReview;
                    $changed = true;
                }
            } elseif ($oldSettlement !== PaymentAttemptSettlementStatus::Paid) {
                $target = match ($status) {
                    'failed', 'rejected', 'denied', 'cancelled' => PaymentAttemptSettlementStatus::Failed,
                    'expired' => PaymentAttemptSettlementStatus::Expired,
                    'pending' => PaymentAttemptSettlementStatus::Pending,
                    default => PaymentAttemptSettlementStatus::Unknown,
                };
                if ($oldSettlement !== $target && $this->settlementRank($target) > $this->settlementRank($oldSettlement)) {
                    $lockedAttempt->settlement_status = $target;
                    $changed = true;
                }
            }

            if ($changed && in_array($lockedAttempt->settlement_status, [PaymentAttemptSettlementStatus::Failed, PaymentAttemptSettlementStatus::Expired], true)
                && $order->payment_status === 'pending') {
                $order->confirmation_expires_at = now()->addMinutes((int) config('order.payment_retry_window_minutes', 15));
                $order->save();
            }

            if ($event->gatewayReference !== null && $event->gatewayReference !== $lockedAttempt->invoice_number) {
                $lockedAttempt->gateway_transaction_id = $event->gatewayReference;
            } elseif ($event->gatewayReference !== null) {
                $lockedAttempt->metadata = array_merge($lockedAttempt->metadata ?? [], ['last_gateway_reference_evidence' => $event->gatewayReference]);
            }
            if ($event->amount !== null) {
                $lockedAttempt->gateway_amount = $event->amount;
            }
            $lockedAttempt->gateway_currency = strtoupper($event->currency);
            $lockedAttempt->gateway_status = $event->gatewayStatus;
            $lockedAttempt->raw_response = $event->rawEvidence;
            $lockedAttempt->metadata = array_merge($lockedAttempt->metadata ?? [], [
                'last_event_received_at' => $event->receivedAt->toIso8601String(),
                'last_event_source' => $event->source,
                'last_event_anomaly' => $needsReview,
            ]);
            if ($changed) {
                $lockedAttempt->status_version++;
            }
            $lockedAttempt->save();

            $winner = false;
            if ($lockedAttempt->settlement_status === PaymentAttemptSettlementStatus::Paid
                && ($lockedAttempt->verification_status === PaymentAttemptVerificationStatus::Verified || $this->isTerminalOrder($order))) {
                $winner = $this->claimOrRefund($lockedAttempt, $order);
            }
            if ($status === 'success' && $changed && $order->paid_at === null) {
                $order->paid_at = now();
                $order->save();
            }

            app(OrderPaymentProjectionService::class)->recompute($order);

            $this->recordOutboxEvents($lockedAttempt, $order, $status, $changed, $winner, $needsReview);
            app(PaymentObservabilityService::class)->transition(
                $lockedAttempt,
                $order,
                $status,
                $needsReview ? 'needs_review' : ($winner ? 'fulfilled' : ($changed ? 'transitioned' : 'duplicate')),
                $needsReview ? 'amount_mismatch' : null,
            );

            return new TransitionResult($changed, $winner, $needsReview);
        }, 3);
    }

    private function normalizeReference(PaymentAttempt $attempt, NormalizedPaymentEvent $event): ?string
    {
        return $event->gatewayReference;
    }

    private function validateInvoice(PaymentAttempt $attempt, string $invoice): void
    {
        if ($invoice !== $attempt->invoice_number) {
            throw new \InvalidArgumentException('Payment invoice does not match attempt.');
        }
    }

    private function validate(PaymentAttempt $attempt, NormalizedPaymentEvent $event): void
    {
        if (strtoupper($event->currency) !== strtoupper($attempt->currency_snapshot)) {
            throw new \InvalidArgumentException('Payment currency does not match attempt.');
        }
    }

    private function settlementRank(PaymentAttemptSettlementStatus $status): int
    {
        return match ($status) {
            PaymentAttemptSettlementStatus::Pending => 10,
            PaymentAttemptSettlementStatus::Unknown => 20,
            PaymentAttemptSettlementStatus::Failed => 30,
            PaymentAttemptSettlementStatus::Expired => 40,
            PaymentAttemptSettlementStatus::Paid => 50,
        };
    }

    private function isTerminalOrder(Order $order): bool
    {
        return in_array($order->status, [
            Order::STATUS_CANCELLED_BY_CUSTOMER,
            Order::STATUS_CANCELLED_BY_OUTLET,
            Order::STATUS_REJECTED_BY_OUTLET,
            Order::STATUS_EXPIRED,
        ], true);
    }

    private function amountMatches(PaymentAttempt $attempt, NormalizedPaymentEvent $event): bool
    {
        if ($event->amount === null) {
            return false;
        }

        $actual = $this->minorUnits($event->amount);
        $expected = $this->minorUnits($attempt->amount_snapshot);

        return $actual !== null && $expected !== null && $actual === $expected;
    }

    private function minorUnits(int|float|string|null $amount): ?int
    {
        if ($amount === null || is_float($amount)) {
            return null;
        }
        $value = (string) $amount;
        if (! preg_match('/^\\d+(?:\\.\\d{1,2})?$/', $value)) {
            return null;
        }
        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');

        return ((int) $whole * 100) + (int) str_pad($fraction, 2, '0');
    }

    private function claimOrRefund(PaymentAttempt $attempt, Order $order): bool
    {
        $claimMatches = $order->fulfilment_claimed_by === $attempt->id
             && $order->fulfilment_claimed_at !== null;
        if ($claimMatches) {
            if ($attempt->fulfilment_claimed_at === null) {
                $attempt->update(['fulfilment_claimed_at' => $order->fulfilment_claimed_at]);
            }

            if ($order->status !== Order::STATUS_COMPLETED) {
                app(OrderStatusService::class)->completeFromPayment($order->fresh(['items']));
            }

            return true;
        }

        if ($this->isTerminalOrder($order)) {
            $this->createRefundObligation($attempt, 'late_payment');

            return false;
        }

        if ($order->fulfilment_claimed_at !== null || $order->fulfilment_claimed_by !== null || $attempt->fulfilment_claimed_at !== null) {
            $claimant = $order->fulfilment_claimed_by
                ? PaymentAttempt::query()->whereKey($order->fulfilment_claimed_by)->lockForUpdate()->first()
                : null;
            if ($claimant === null) {
                $order->update(['fulfilment_claimed_at' => null, 'fulfilment_claimed_by' => null]);
                $attempt->update(['fulfilment_claimed_at' => null]);
            } elseif ($order->fulfilment_claimed_by !== $attempt->id || $attempt->fulfilment_claimed_at === null) {
                $this->createRefundObligation($attempt, 'duplicate_paid_attempt');

                return false;
            }
        }

        if (in_array($order->status, [
            Order::STATUS_CANCELLED_BY_CUSTOMER,
            Order::STATUS_CANCELLED_BY_OUTLET,
            Order::STATUS_REJECTED_BY_OUTLET,
            Order::STATUS_EXPIRED,
        ], true)) {
            $this->createRefundObligation($attempt, 'late_payment');

            return false;
        }

        $claimed = Order::query()->whereKey($order->id)
            ->whereNull('fulfilment_claimed_at')
            ->update(['fulfilment_claimed_at' => now(), 'fulfilment_claimed_by' => $attempt->id]);
        if ($claimed === 1) {
            $attempt->fulfilment_claimed_at = now();
            $attempt->save();
            $order->fulfilment_claimed_at = $attempt->fulfilment_claimed_at;
            $order->fulfilment_claimed_by = $attempt->id;
            app(OrderStatusService::class)->completeFromPayment($order->fresh(['items']));

            return true;
        }
        $this->createRefundObligation($attempt, 'duplicate_paid_attempt');

        return false;
    }

    private function createRefundObligation(PaymentAttempt $attempt, string $reason): void
    {
        RefundObligation::firstOrCreate(
            ['payment_attempt_id' => $attempt->id, 'reason' => $reason],
            ['amount' => $attempt->gateway_amount ?? $attempt->amount_snapshot, 'currency' => $attempt->currency_snapshot, 'status' => RefundObligationStatus::Pending]
        );
    }

    private function recordOutboxEvents(PaymentAttempt $attempt, Order $order, string $status, bool $changed, bool $winner, bool $needsReview): void
    {
        $events = [];
        if ($status === 'success' && $changed) {
            $events[] = ['type' => 'payment.paid', 'key' => "payment.paid:{$attempt->id}:{$attempt->status_version}"];
        }
        if ($winner) {
            $events[] = ['type' => 'fulfilment.claimed', 'key' => "fulfilment.claimed:{$attempt->id}"];
        }
        if ($status === 'success' && $this->isTerminalOrder($order)) {
            $events[] = ['type' => 'payment.late_success', 'key' => "payment.late_success:{$attempt->id}:{$attempt->status_version}"];
        }
        if ($needsReview) {
            $events[] = ['type' => 'payment.needs_review', 'key' => "payment.needs_review:{$attempt->id}:{$attempt->status_version}"];
        }
        foreach (RefundObligation::query()->where('payment_attempt_id', $attempt->id)->get() as $obligation) {
            $events[] = ['type' => 'refund.obligation_created', 'key' => "refund.obligation_created:{$obligation->id}"];
        }
        foreach ($events as $definition) {
            $event = PaymentOutboxEvent::firstOrCreate(
                ['event_key' => $definition['key']],
                ['event_type' => $definition['type'], 'aggregate_type' => 'payment_attempt', 'aggregate_id' => $attempt->id, 'payload' => ['order_id' => $order->id, 'payment_attempt_id' => $attempt->id]]
            );
            DB::afterCommit(function () use ($event): void {
                try {
                    DispatchPaymentOutboxEvent::dispatch($event->id);
                } catch (\Throwable $exception) {
                    PaymentOutboxEvent::query()->whereKey($event->id)->where('status', 'pending')->whereNull('delivered_at')->update(['last_error' => $exception->getMessage(), 'next_attempt_at' => now()]);
                }
            });
        }
    }
}
