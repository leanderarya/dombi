<?php

namespace App\Services;

use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SettlementPaymentService
{
    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    /**
     * Record a payment against a settlement.
     */
    public function recordPayment(
        Settlement $settlement,
        float $amount,
        ?string $referenceNumber,
        ?string $notes,
        User $user,
        ?string $proofImage = null,
        string $paymentMethod = 'transfer_bank',
    ): SettlementPayment {
        return SettlementPayment::create([
            'outlet_id' => $settlement->outlet_id,
            'settlement_id' => $settlement->id,
            'reference_number' => $referenceNumber ?? 'PAY-'.strtoupper(Str::random(8)),
            'payment_date' => now()->toDateString(),
            'amount' => $amount,
            'payment_method' => $paymentMethod,
            'proof_image' => $proofImage,
            'notes' => $notes,
            'status' => SettlementPayment::STATUS_PENDING,
        ]);
    }

    /**
     * Verify a single payment and FIFO-allocate across unpaid settlements.
     * Uses lockForUpdate to prevent race conditions.
     * Notification is sent after transaction commits.
     */
    public function verifyPayment(SettlementPayment $payment, User $user): void
    {
        if (! $payment->isPending()) {
            return;
        }

        DB::transaction(function () use ($payment, $user) {
            $payment->update([
                'status' => SettlementPayment::STATUS_VERIFIED,
                'verified_by' => $user->id,
                'verified_at' => now(),
            ]);

            $this->fifoAllocate($payment->outlet_id, (float) $payment->amount);
        });

        $payment->load('outlet');
        $this->notificationService->notifyPaymentVerified($payment);
    }

    /**
     * Bulk verify multiple payments in a single transaction.
     * Returns the count of verified payments.
     * Notifications are sent after the transaction commits.
     */
    public function bulkVerifyPayments(array $paymentIds, User $user): int
    {
        $verifiedPayments = [];
        // Track allocation per outlet (sum of all verified amounts in this batch)
        $outletAllocations = [];

        DB::transaction(function () use ($paymentIds, $user, &$verifiedPayments, &$outletAllocations) {
            foreach ($paymentIds as $paymentId) {
                $payment = SettlementPayment::lockForUpdate()->find($paymentId);
                if (! $payment || ! $payment->isPending()) {
                    continue;
                }

                $payment->update([
                    'status' => SettlementPayment::STATUS_VERIFIED,
                    'verified_by' => $user->id,
                    'verified_at' => now(),
                ]);

                $verifiedPayments[] = $payment;

                // Accumulate per outlet
                $oid = $payment->outlet_id;
                $outletAllocations[$oid] = ($outletAllocations[$oid] ?? 0) + (float) $payment->amount;
            }

            // FIFO-allocate per outlet (one pass per outlet for the entire batch)
            foreach ($outletAllocations as $outletId => $totalAmount) {
                $this->fifoAllocate($outletId, $totalAmount);
            }
        });

        // Send notifications after transaction commits
        foreach ($verifiedPayments as $payment) {
            $payment->load('outlet');
            $this->notificationService->notifyPaymentVerified($payment);
        }

        return count($verifiedPayments);
    }

    /**
     * Reject a payment.
     */
    public function rejectPayment(SettlementPayment $payment, string $reason): void
    {
        $payment->update([
            'status' => SettlementPayment::STATUS_REJECTED,
            'rejection_reason' => $reason,
        ]);

        $payment->load('outlet');
        $this->notificationService->notifyPaymentRejected($payment, $reason);
    }

    /**
     * FIFO-allocate an amount across unpaid settlements for an outlet.
     * Oldest settlement first. Updates paid_amount and recalculates status.
     * Must be called inside a DB transaction with proper locking.
     */
    public function fifoAllocate(int $outletId, float $amount): void
    {
        $remaining = $amount;

        $unpaidSettlements = Settlement::where('outlet_id', $outletId)
            ->where('period_type', 'weekly')
            ->where('status', '!=', Settlement::STATUS_PAID)
            ->lockForUpdate()
            ->orderBy('period_start', 'asc')
            ->get();

        foreach ($unpaidSettlements as $settlement) {
            if ($remaining <= 0) {
                break;
            }

            $outstanding = max(0, (float) $settlement->amount_due - (float) $settlement->paid_amount - (float) $settlement->adjustment_amount);
            $allocate = min($remaining, $outstanding);

            if ($allocate > 0) {
                $settlement->paid_amount = (float) $settlement->paid_amount + $allocate;
                $settlement->recalculateStatus();
                $remaining -= $allocate;
            }
        }

        // If remaining > 0 after all settlements are covered, it's overpayment on the last one
        // (already handled by recalculateStatus → overpaid_amount)
    }
}
