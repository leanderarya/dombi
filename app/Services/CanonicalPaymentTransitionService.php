<?php

namespace App\Services;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Enums\RefundObligationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use Illuminate\Support\Facades\DB;

class CanonicalPaymentTransitionService
{
    public function apply(PaymentAttempt $attempt, NormalizedPaymentEvent $event): TransitionResult
    {
        return DB::transaction(function () use ($attempt, $event): TransitionResult {
            $lockedAttempt = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            $order = Order::query()->whereKey($lockedAttempt->order_id)->lockForUpdate()->firstOrFail();
            $this->validate($lockedAttempt, $event);

            $status = strtolower($event->gatewayStatus);
            $oldSettlement = $lockedAttempt->settlement_status;
            $changed = false;
            $needsReview = false;

            if ($status === 'success') {
                $needsReview = ! $this->amountMatches($lockedAttempt, $event);
                if ($oldSettlement !== PaymentAttemptSettlementStatus::Paid) {
                    $lockedAttempt->settlement_status = PaymentAttemptSettlementStatus::Paid;
                    $changed = true;
                }
                if ($lockedAttempt->verification_status !== PaymentAttemptVerificationStatus::Verified && ! $needsReview) {
                    $lockedAttempt->verification_status = PaymentAttemptVerificationStatus::Verified;
                    $changed = true;
                }
                if ($needsReview && $lockedAttempt->verification_status !== PaymentAttemptVerificationStatus::NeedsReview) {
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
                if ($oldSettlement !== $target) {
                    $lockedAttempt->settlement_status = $target;
                    $changed = true;
                }
            }

            if ($event->gatewayReference !== null) {
                $lockedAttempt->gateway_transaction_id = $event->gatewayReference;
            }
            $lockedAttempt->gateway_amount = $event->amount;
            $lockedAttempt->gateway_currency = strtoupper($event->currency);
            $lockedAttempt->gateway_status = $event->gatewayStatus;
            $lockedAttempt->raw_response = $event->rawEvidence;
            if ($changed || $event->gatewayReference !== null) {
                $lockedAttempt->status_version++;
                $lockedAttempt->save();
            }

            $winner = false;
            if ($lockedAttempt->settlement_status === PaymentAttemptSettlementStatus::Paid
                && $lockedAttempt->verification_status === PaymentAttemptVerificationStatus::Verified) {
                $winner = $this->claimOrRefund($lockedAttempt, $order);
            }

            app(OrderPaymentProjectionService::class)->recompute($order);

            return new TransitionResult($changed, $winner, $needsReview);
        });
    }

    private function validate(PaymentAttempt $attempt, NormalizedPaymentEvent $event): void
    {
        if (strtoupper($event->currency) !== strtoupper($attempt->currency_snapshot)) {
            throw new \InvalidArgumentException('Payment currency does not match attempt.');
        }
        if ($event->gatewayReference !== null && $attempt->invoice_number !== $event->gatewayReference
            && $attempt->gateway_transaction_id !== null && $attempt->gateway_transaction_id !== $event->gatewayReference) {
            throw new \InvalidArgumentException('Payment gateway reference does not match attempt.');
        }
    }

    private function amountMatches(PaymentAttempt $attempt, NormalizedPaymentEvent $event): bool
    {
        return $event->amount !== null && number_format((float) $event->amount, 2, '.', '') === number_format((float) $attempt->amount_snapshot, 2, '.', '');
    }

    private function claimOrRefund(PaymentAttempt $attempt, Order $order): bool
    {
        $winner = PaymentAttempt::query()->where('order_id', $order->id)
            ->where('settlement_status', PaymentAttemptSettlementStatus::Paid)
            ->where('verification_status', PaymentAttemptVerificationStatus::Verified)
            ->whereNotNull('fulfilment_claimed_at')->exists();
        if (! $winner) {
            $attempt->fulfilment_claimed_at = now();
            $attempt->save();

            return true;
        }
        RefundObligation::firstOrCreate(
            ['payment_attempt_id' => $attempt->id, 'reason' => 'duplicate_paid_attempt'],
            ['amount' => $attempt->gateway_amount ?? $attempt->amount_snapshot, 'currency' => $attempt->currency_snapshot, 'status' => RefundObligationStatus::Pending]
        );

        return false;
    }
}
