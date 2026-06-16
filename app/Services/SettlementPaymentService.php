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
     * Verify a payment and update the settlement. Wrapped in transaction.
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

            // Update settlement paid_amount
            if ($payment->settlement_id) {
                $settlement = $payment->settlement;
                if ($settlement) {
                    $settlement->paid_amount = (float) $settlement->paid_amount + (float) $payment->amount;
                    $settlement->recalculateStatus();
                }
            }
        });

        $payment->load('outlet');
        $this->notificationService->notifyPaymentVerified($payment);
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
}
