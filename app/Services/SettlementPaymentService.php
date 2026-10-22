<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Models\SettlementPaymentAllocation;
use App\Models\SettlementReconciliationIssue;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

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
        return DB::transaction(function () use ($settlement, $amount, $referenceNumber, $notes, $proofImage, $paymentMethod): SettlementPayment {
            $outletId = Settlement::query()->whereKey($settlement->id)->value('outlet_id');
            if ($outletId === null) {
                throw new \RuntimeException('Settlement outlet not found.');
            }

            Outlet::lockForSettlement((int) $outletId);
            $target = Settlement::query()->whereKey($settlement->id)->firstOrFail();
            $candidateSettlements = $this->lockAllocationSettlements(
                (int) $outletId,
                (string) $target->direction,
                [(int) $target->id],
            );
            $lockedSettlement = $candidateSettlements->first(fn (Settlement $candidate) => (int) $candidate->id === (int) $target->id
                && (int) $candidate->outlet_id === (int) $outletId
                && $candidate->direction === $target->direction
            );
            if (! $lockedSettlement) {
                throw $this->blockedPaymentException();
            }
            $unpaidSettlements = $this->unpaidAllocationSettlements($candidateSettlements, $target->direction);
            if ($amount < 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Jumlah pembayaran tidak valid.',
                ]);
            }
            $hasOpenIssue = $this->allocationPathHasOpenIssue(
                $unpaidSettlements,
                $amount,
                [(int) $target->id],
            );
            if (! $hasOpenIssue) {
                $totalOutstanding = (float) $unpaidSettlements->sum(fn (Settlement $candidate) => $this->settlementOutstanding($candidate));
                if ($amount > $totalOutstanding) {
                    throw ValidationException::withMessages(['amount' => 'Jumlah pembayaran melebihi total tagihan.']);
                }
            }
            $hasPending = SettlementPayment::query()
                ->where('outlet_id', $outletId)
                ->where('direction', $target->direction)
                ->where('status', SettlementPayment::STATUS_PENDING)
                ->exists();
            if ($hasPending) {
                throw ValidationException::withMessages(['payment' => 'Sudah ada pembayaran yang menunggu verifikasi.']);
            }
            $settlementId = $hasOpenIssue ? null : $target->id;

            return SettlementPayment::create([
                'outlet_id' => $lockedSettlement->outlet_id,
                'settlement_id' => $settlementId,
                'direction' => $lockedSettlement->direction,
                'reference_number' => $referenceNumber ?? 'PAY-'.strtoupper(Str::random(8)),
                'payment_date' => now()->toDateString(),
                'amount' => $amount,
                'payment_method' => $paymentMethod,
                'proof_image' => $proofImage,
                'notes' => $notes,
                'status' => SettlementPayment::STATUS_PENDING,
            ]);
        });
    }

    /**
     * Verify a single payment and FIFO-allocate across unpaid settlements.
     * Uses lockForUpdate to prevent race conditions.
     * Notification is sent after transaction commits.
     */
    public function verifyPayment(SettlementPayment $payment, User $user): void
    {
        $verified = DB::transaction(function () use ($payment, $user): ?SettlementPayment {
            $outletId = SettlementPayment::query()->whereKey($payment->id)->value('outlet_id');
            if ($outletId === null) {
                return null;
            }

            Outlet::lockForSettlement((int) $outletId);
            $lockedPayment = SettlementPayment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ((int) $lockedPayment->outlet_id !== (int) $outletId || ! $lockedPayment->isPending()) {
                return null;
            }

            $lockedSettlements = $this->lockAllocationSettlements(
                (int) $outletId,
                $lockedPayment->direction,
                $lockedPayment->settlement_id ? [(int) $lockedPayment->settlement_id] : [],
            );
            if ($lockedPayment->settlement_id && ! $lockedSettlements->contains(fn (Settlement $settlement) => (int) $settlement->id === (int) $lockedPayment->settlement_id
                && (int) $settlement->outlet_id === (int) $outletId
                && $settlement->direction === $lockedPayment->direction
            )) {
                throw $this->blockedPaymentException();
            }
            $settlements = $this->unpaidAllocationSettlements($lockedSettlements, $lockedPayment->direction);
            if ((float) $lockedPayment->amount < 0) {
                throw ValidationException::withMessages(['payment' => 'Jumlah pembayaran tidak valid.']);
            }
            if ((float) $lockedPayment->amount > 0 && $settlements->isEmpty()) {
                throw ValidationException::withMessages(['payment' => 'Tidak ada settlement belum dibayar untuk arah ini.']);
            }
            $this->assertPaymentAllocationAllowed($lockedPayment, $settlements);

            $lockedPayment->update([
                'status' => SettlementPayment::STATUS_VERIFIED,
                'verified_by' => $user->id,
                'verified_at' => now(),
            ]);
            $this->applyFifoAllocation($settlements, (float) $lockedPayment->amount, $lockedPayment->id);

            return $lockedPayment;
        });

        if ($verified) {
            $verified->load('outlet');
            $this->notificationService->notifyPaymentVerified($verified);
        }
    }

    /**
     * Bulk verify multiple payments in a single transaction.
     * Returns the count of verified payments.
     * Notifications are sent after the transaction commits.
     */
    public function bulkVerifyPayments(array $paymentIds, User $user): int
    {
        $verifiedPayments = [];

        DB::transaction(function () use ($paymentIds, $user, &$verifiedPayments) {
            $outletIds = SettlementPayment::query()
                ->whereIn('id', array_unique($paymentIds))
                ->distinct()
                ->orderBy('outlet_id')
                ->pluck('outlet_id');
            foreach ($outletIds as $outletId) {
                Outlet::lockForSettlement((int) $outletId);
            }

            $payments = SettlementPayment::query()
                ->whereIn('id', array_unique($paymentIds))
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $pendingPayments = collect(array_unique($paymentIds))
                ->map(fn ($paymentId) => $payments->get($paymentId))
                ->filter(fn (?SettlementPayment $payment) => $payment?->isPending())
                ->values();
            $allocationPaths = [];

            foreach ($pendingPayments->groupBy(fn (SettlementPayment $payment) => $payment->outlet_id.':'.$payment->direction) as $key => $group) {
                [$outletId, $direction] = explode(':', $key, 2);
                $paymentSettlementIds = $group->pluck('settlement_id')->filter()->map(fn ($id) => (int) $id)->all();
                $lockedSettlements = $this->lockAllocationSettlements((int) $outletId, $direction, $paymentSettlementIds);
                if ($group->contains(fn (SettlementPayment $payment) => (float) $payment->amount < 0)) {
                    throw ValidationException::withMessages(['payment' => 'Jumlah pembayaran tidak valid.']);
                }
                foreach ($group as $payment) {
                    if ($payment->settlement_id && ! $lockedSettlements->contains(fn (Settlement $settlement) => (int) $settlement->id === (int) $payment->settlement_id
                        && (int) $settlement->outlet_id === (int) $outletId
                        && $settlement->direction === $direction
                    )) {
                        throw $this->blockedPaymentException();
                    }
                }
                $settlements = $this->unpaidAllocationSettlements($lockedSettlements, $direction);
                foreach ($group as $payment) {
                    if ((float) $payment->amount < 0) {
                        throw ValidationException::withMessages(['payment' => 'Jumlah pembayaran tidak valid.']);
                    }
                    if ($payment->settlement_id && ! $settlements->contains(fn (Settlement $candidate) => (int) $candidate->id === (int) $payment->settlement_id
                        && (int) $candidate->outlet_id === (int) $outletId
                        && $candidate->direction === $direction
                    )) {
                        throw ValidationException::withMessages(['payment' => 'Settlement target pembayaran sudah lunas atau tidak lagi cocok dengan arah/outlet.']);
                    }
                }
                if ($settlements->isEmpty() && (float) $group->sum('amount') > 0) {
                    throw ValidationException::withMessages(['payment' => 'Tidak ada settlement belum dibayar untuk arah ini.']);
                }
                $totalAmount = (float) $group->sum(fn (SettlementPayment $payment) => (float) $payment->amount);
                if ($this->allocationPathHasOpenIssue($settlements, $totalAmount, $paymentSettlementIds)) {
                    throw $this->blockedPaymentException();
                }
                $allocationPath = $settlements->map(fn (Settlement $settlement) => clone $settlement);
                if ($totalAmount > (float) $allocationPath->sum(fn (Settlement $settlement) => $this->settlementOutstanding($settlement))) {
                    throw ValidationException::withMessages(['payment' => 'Jumlah pembayaran melebihi total tagihan.']);
                }
                foreach ($group as $payment) {
                    $this->applyFifoAllocation($allocationPath, (float) $payment->amount);
                }
                $allocationPaths[$key] = [$settlements, $group];
            }

            foreach ($pendingPayments as $payment) {
                $payment->update([
                    'status' => SettlementPayment::STATUS_VERIFIED,
                    'verified_by' => $user->id,
                    'verified_at' => now(),
                ]);
                $verifiedPayments[] = $payment;
            }

            foreach ($allocationPaths as [$settlements, $group]) {
                foreach ($group as $payment) {
                    $this->applyFifoAllocation($settlements, (float) $payment->amount, $payment->id);
                }
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
        $rejected = DB::transaction(function () use ($payment, $reason): ?SettlementPayment {
            $outletId = SettlementPayment::query()->whereKey($payment->id)->value('outlet_id');
            if ($outletId === null) {
                return null;
            }

            Outlet::lockForSettlement((int) $outletId);
            $lockedPayment = SettlementPayment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ((int) $lockedPayment->outlet_id !== (int) $outletId || ! $lockedPayment->isPending()) {
                return null;
            }

            $lockedPayment->update([
                'status' => SettlementPayment::STATUS_REJECTED,
                'rejection_reason' => $reason,
            ]);

            return $lockedPayment;
        });

        if ($rejected) {
            $rejected->load('outlet');
            $this->notificationService->notifyPaymentRejected($rejected, $reason);
        }
    }

    /**
     * FIFO-allocate an amount across unpaid settlements for an outlet.
     * Oldest settlement first. Updates paid_amount and recalculates status.
     * Must be called inside a DB transaction with proper locking.
     */
    public function fifoAllocate(int $outletId, float $amount, ?int $settlementPaymentId = null, string $direction = Settlement::DIRECTION_OUTLET_PAYS): void
    {
        if (! DB::transactionLevel()) {
            throw new \LogicException('FIFO allocation requires an active transaction.');
        }

        if ($amount < 0) {
            throw ValidationException::withMessages(['payment' => 'Jumlah pembayaran tidak valid.']);
        }

        Outlet::lockForSettlement($outletId);
        $settlements = $this->unpaidAllocationSettlements(
            $this->lockAllocationSettlements($outletId, $direction),
            $direction,
        );
        if ($amount > 0 && $settlements->isEmpty()) {
            throw ValidationException::withMessages(['payment' => 'Tidak ada settlement belum dibayar untuk arah ini.']);
        }
        $this->throwIfAllocationPathHasOpenIssue($settlements, $amount);
        $totalOutstanding = (float) $settlements->sum(fn (Settlement $settlement) => $this->settlementOutstanding($settlement));
        if ($amount > $totalOutstanding) {
            throw ValidationException::withMessages(['payment' => 'Jumlah pembayaran melebihi total tagihan.']);
        }
        $this->applyFifoAllocation($settlements, $amount, $settlementPaymentId);
    }

    /**
     * Lock exact FIFO candidates for a direction, including a payment's explicit target.
     *
     * @param  array<int, int>  $additionalSettlementIds
     */
    private function lockAllocationSettlements(int $outletId, string $direction, array $additionalSettlementIds = []): Collection
    {
        $additionalSettlementIds = array_values(array_unique(array_map('intval', $additionalSettlementIds)));

        return Settlement::query()
            ->where('outlet_id', $outletId)
            ->where('period_type', 'weekly')
            ->where(function ($query) use ($direction, $additionalSettlementIds): void {
                $query->where(function ($query) use ($direction): void {
                    $query->where('direction', $direction)
                        ->where('status', '!=', Settlement::STATUS_PAID);
                });
                if ($additionalSettlementIds !== []) {
                    $query->orWhereIn('id', $additionalSettlementIds);
                }
            })
            ->orderBy('period_start')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
    }

    private function assertPaymentAllocationAllowed(SettlementPayment $payment, Collection $settlements): void
    {
        $targetId = $payment->settlement_id ? (int) $payment->settlement_id : null;
        $this->throwIfAllocationPathHasOpenIssue(
            $settlements,
            (float) $payment->amount,
            $targetId ? [$targetId] : [],
        );
    }

    private function allocationPathIds(Collection $settlements, float $amount): Collection
    {
        $remaining = max(0, $amount);
        $ids = collect();
        foreach ($settlements as $settlement) {
            if ($remaining <= 0) {
                break;
            }

            $outstanding = $this->settlementOutstanding($settlement);
            if ($outstanding <= 0) {
                continue;
            }

            $ids->push((int) $settlement->id);
            $remaining -= min($remaining, $outstanding);
        }

        if ($remaining > 0 && $settlements->isNotEmpty()) {
            $ids->push((int) $settlements->last()->id);
        }

        return $ids;
    }

    private function settlementOutstanding(Settlement $settlement): float
    {
        return max(0, abs((float) $settlement->net_amount) - (float) $settlement->paid_amount - (float) $settlement->adjustment_amount);
    }

    private function unpaidAllocationSettlements(Collection $settlements, string $direction): Collection
    {
        return $settlements
            ->filter(fn (Settlement $settlement) => $settlement->direction === $direction
                && $settlement->status !== Settlement::STATUS_PAID
            )
            ->values();
    }

    public function settlementsHaveOpenIssue(Collection $settlements): bool
    {
        return $this->hasOpenIssueForSettlementIds($settlements->modelKeys());
    }

    public function allocationPathHasOpenIssue(Collection $settlements, float $amount, array $additionalSettlementIds = []): bool
    {
        $pathIds = $this->allocationPathIds($settlements, $amount);
        foreach ($additionalSettlementIds as $settlementId) {
            $pathIds->push((int) $settlementId);
        }

        return $this->hasOpenIssueForSettlementIds($pathIds->unique()->all());
    }

    public function throwIfAllocationPathHasOpenIssue(Collection $settlements, float $amount, array $additionalSettlementIds = []): void
    {
        if ($this->allocationPathHasOpenIssue($settlements, $amount, $additionalSettlementIds)) {
            throw $this->blockedPaymentException();
        }
    }

    private function hasOpenIssueForSettlementIds(array $settlementIds): bool
    {
        if ($settlementIds === []) {
            return false;
        }

        return SettlementReconciliationIssue::query()
            ->whereIn('settlement_id', $settlementIds)
            ->where('status', 'open')
            ->lockForUpdate()
            ->first() !== null;
    }

    private function blockedPaymentException(): ValidationException
    {
        return ValidationException::withMessages([
            'payment' => 'Pembayaran diblokir karena rekonsiliasi settlement belum selesai. Bukti transfer tetap tersimpan; proses verifikasi setelah isu diselesaikan.',
        ]);
    }

    /**
     * Apply a previously validated and locked FIFO path.
     */
    private function applyFifoAllocation(Collection $unpaidSettlements, float $amount, ?int $settlementPaymentId = null): void
    {
        $remaining = max(0, $amount);

        foreach ($unpaidSettlements as $settlement) {
            if ($remaining <= 0) {
                break;
            }

            $outstanding = $this->settlementOutstanding($settlement);
            $allocate = min($remaining, $outstanding);

            if ($allocate > 0) {
                $settlement->paid_amount = (float) $settlement->paid_amount + $allocate;
                $settlement->recalculateStatus();
                $remaining -= $allocate;

                if ($settlementPaymentId) {
                    SettlementPaymentAllocation::create([
                        'settlement_payment_id' => $settlementPaymentId,
                        'settlement_id' => $settlement->id,
                        'allocated_amount' => $allocate,
                    ]);
                }
            }
        }

        // If remaining > 0 after all settlements are covered, save as overpayment on last settlement
        if ($remaining > 0 && $unpaidSettlements->isNotEmpty()) {
            $last = $unpaidSettlements->last();
            $last->overpaid_amount = (float) $last->overpaid_amount + $remaining;
            $last->recalculateStatus();

            if ($settlementPaymentId) {
                SettlementPaymentAllocation::create([
                    'settlement_payment_id' => $settlementPaymentId,
                    'settlement_id' => $last->id,
                    'allocated_amount' => $remaining,
                ]);
            }
        }
    }
}
