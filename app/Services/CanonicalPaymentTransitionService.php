<?php

namespace App\Services;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Enums\RefundObligationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class CanonicalPaymentTransitionService
{
    public function apply(PaymentAttempt $attempt, NormalizedPaymentEvent $event): TransitionResult
    {
        return DB::transaction(function () use ($attempt, $event): TransitionResult {
            $lockedAttempt = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            $order = Order::query()->whereKey($lockedAttempt->order_id)->lockForUpdate()->firstOrFail();
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

            app(OrderPaymentProjectionService::class)->recompute($order);

            return new TransitionResult($changed, $winner, $needsReview);
        });
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
        if ($attempt->fulfilment_claimed_at !== null) {
            return true;
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

        $winner = PaymentAttempt::query()->where('order_id', $order->id)
            ->where('settlement_status', PaymentAttemptSettlementStatus::Paid)
            ->where('verification_status', PaymentAttemptVerificationStatus::Verified)
            ->whereNotNull('fulfilment_claimed_at')->exists();
        if (! $winner) {
            $attempt->fulfilment_claimed_at = now();
            $attempt->save();

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
}
