<?php

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Enums\RefundObligationStatus;
use App\Enums\RefundRejectionReason;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use App\Models\RefundStatusHistory;
use Carbon\Carbon;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RefundService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly RefundObligationService $obligations,
    ) {}

    private const REQUEST_SOURCES = [
        'customer_cancellation',
        'outlet_rejection',
        'outlet_cancellation',
        'expiry',
        'late_payment',
        'manual_mark_paid',
    ];

    private const ACTOR_TYPES = [
        'customer', 'guest', 'outlet', 'owner', 'system',
    ];

    public function request(Order $order, string $actorType, ?int $actorId, string $source): ?RefundStatusHistory
    {
        if (! in_array($actorType, self::ACTOR_TYPES, true)) {
            throw new DomainException('Invalid actor type.');
        }

        if (! in_array($source, self::REQUEST_SOURCES, true)) {
            throw new DomainException('Invalid refund source.');
        }

        return DB::transaction(function () use ($order, $actorType, $actorId, $source) {
            $locked = Order::lockForUpdate()
                ->with('paymentTransactions')
                ->findOrFail($order->id);

            if (in_array($locked->payment_status, [
                PaymentStatus::RefundPending->value,
                PaymentStatus::RefundInProgress->value,
                PaymentStatus::Refunded->value,
                PaymentStatus::RefundRejected->value,
                PaymentStatus::RefundFailed->value,
            ], true)) {
                return null;
            }

            if (! in_array($locked->payment_status, [
                PaymentStatus::Paid->value,
                PaymentStatus::Settled->value,
            ], true)) {
                return null;
            }

            $trustedPaidAmount = $this->computeTrustedPaidAmount($locked);

            if ((float) $locked->total <= 0 || $trustedPaidAmount <= 0 || (float) $locked->total > $trustedPaidAmount) {
                throw new DomainException('Refund amount melebihi pembayaran terverifikasi.');
            }

            $fromStatus = $locked->payment_status;
            $attempt = $locked->paymentAttempts()
                ->where('verification_status', 'verified')
                ->where(function ($query): void {
                    $query->whereNull('metadata->provenance')
                        ->orWhere('metadata->provenance', '!=', 'synthetic_legacy_refund');
                })
                ->latest('id')
                ->first();

            if (! $attempt && $locked->paid_at !== null) {
                $attempt = $locked->paymentAttempts()->create([
                    'attempt_key' => 'legacy-manual-refund-'.$locked->id,
                    'invoice_number' => 'legacy-manual-refund-'.$locked->id,
                    'merchant_request_id' => 'legacy-manual-refund-'.$locked->id,
                    'amount_snapshot' => $locked->total,
                    'currency_snapshot' => 'IDR',
                    'metadata' => ['provenance' => 'legacy_manual_refund', 'verified' => false],
                ]);
            }

            if (! $attempt) {
                throw new DomainException('Refund membutuhkan pembayaran terverifikasi.');
            }

            $obligation = $this->obligations->createForAttempt($attempt, $source);
            $obligation->update(['metadata' => array_merge($obligation->metadata ?? [], ['requested_at' => now()->toISOString()])]);

            $locked->update([
                'payment_status' => PaymentStatus::RefundPending->value,
                'refund_amount' => (float) $obligation->amount,
                'refund_requested_at' => now(),
                'refund_reason' => $source,
                'refund_destination_status' => Order::REFUND_DESTINATION_MISSING,
            ]);

            $history = RefundStatusHistory::create([
                'order_id' => $locked->id,
                'from_status' => $fromStatus,
                'to_status' => PaymentStatus::RefundPending->value,
                'event' => RefundStatusHistory::EVENT_REFUND_REQUESTED,
                'actor_type' => $actorType,
                'actor_id' => $actorId,
                'metadata' => [
                    'refund_amount' => (float) $obligation->amount,
                    'source_entry_point' => $source,
                ],
            ]);

            DB::afterCommit(fn () => $this->notifications->notifyRefundEvent($history->order->loadMissing('customer'), $history));

            return $history;
        });
    }

    public function submitDestination(Order $order, string $destinationType, string $actorType, ?int $actorId, array $data): RefundStatusHistory
    {
        return DB::transaction(function () use ($order, $destinationType, $actorType, $actorId, $data) {
            $locked = Order::lockForUpdate()
                ->with('customer')
                ->findOrFail($order->id);

            $customer = $locked->customer;
            $obligation = $this->canonicalObligation($locked);

            if ($actorType === 'customer' && $customer?->isGuest()) {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }

            if ($actorType === 'owner' && ! $customer?->isGuest()) {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }

            $this->validateDestinationData($destinationType, $data);

            $rejectionReason = $obligation?->metadata['rejection_reason'] ?? null;
            $eligibleRejection = $obligation
                ? $obligation->status?->value === 'rejected'
                    && in_array($rejectionReason, [
                        RefundRejectionReason::InvalidDestination->value,
                        RefundRejectionReason::IncompleteDestination->value,
                    ], true)
                : $locked->refund_destination_status === Order::REFUND_DESTINATION_INVALID
                    && in_array($locked->refund_rejected_reason, [
                        RefundRejectionReason::InvalidDestination->value,
                        RefundRejectionReason::IncompleteDestination->value,
                    ], true);

            if ($obligation && $obligation->status?->value !== 'pending' && ! $eligibleRejection) {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }

            $updateData = $this->buildDestinationUpdateData($destinationType, $data);
            if ($obligation) {
                $obligation->update($this->obligationDestinationData($destinationType, $data));
            }

            if ($eligibleRejection) {
                $updateData = array_merge($updateData, [
                    'payment_status' => PaymentStatus::RefundPending->value,
                    'refund_destination_status' => Order::REFUND_DESTINATION_VALID,
                    'refund_rejected_reason' => null,
                    'refund_rejection_note' => null,
                    'refund_rejected_at' => null,
                    'refund_rejected_by' => null,
                ]);

                if ($obligation) {
                    $this->obligations->transition($obligation, RefundObligationStatus::Pending);
                }

                $locked->update($updateData);

                $history = RefundStatusHistory::create([
                    'order_id' => $locked->id,
                    'from_status' => PaymentStatus::RefundRejected->value,
                    'to_status' => PaymentStatus::RefundPending->value,
                    'event' => RefundStatusHistory::EVENT_REFUND_REOPENED,
                    'actor_type' => $actorType,
                    'actor_id' => $actorId,
                    'metadata' => ['destination_type' => $destinationType],
                ]);

                DB::afterCommit(fn () => $this->notifications->notifyRefundEvent($history->order->loadMissing('customer'), $history));

                return $history;
            }

            if ($locked->refund_destination_status === Order::REFUND_DESTINATION_MISSING) {
                if ($actorType === 'owner') {
                    $event = RefundStatusHistory::EVENT_GUEST_DESTINATION_SUBMITTED_BY_OWNER;
                } else {
                    $event = RefundStatusHistory::EVENT_DESTINATION_SUBMITTED;
                }
            } elseif ($locked->refund_destination_status === Order::REFUND_DESTINATION_VALID) {
                if ($actorType === 'owner') {
                    $event = RefundStatusHistory::EVENT_GUEST_DESTINATION_UPDATED_BY_OWNER;
                } else {
                    $event = RefundStatusHistory::EVENT_DESTINATION_UPDATED;
                }
            } else {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }

            $updateData['refund_destination_status'] = Order::REFUND_DESTINATION_VALID;

            $locked->update($updateData);

            $history = RefundStatusHistory::create([
                'order_id' => $locked->id,
                'from_status' => $locked->payment_status,
                'to_status' => $locked->payment_status,
                'event' => $event,
                'actor_type' => $actorType,
                'actor_id' => $actorId,
                'metadata' => ['destination_type' => $destinationType],
            ]);

            DB::afterCommit(fn () => $this->notifications->notifyRefundEvent($history->order->loadMissing('customer'), $history));

            return $history;
        });
    }

    public function start(Order $order, int $ownerId): RefundStatusHistory
    {
        return DB::transaction(function () use ($order, $ownerId) {
            $locked = Order::lockForUpdate()->findOrFail($order->id);
            $obligation = $this->canonicalObligation($locked, true);

            if ($obligation && $obligation->status?->value !== 'pending') {
                throw new DomainException('Order ini tidak dalam antrean refund.');
            }

            if (! $obligation && $locked->payment_status !== PaymentStatus::RefundPending->value) {
                throw new DomainException('Order ini tidak dalam antrean refund.');
            }

            if ($obligation && $obligation->destination_type === null) {
                throw new DomainException('Tujuan refund belum lengkap atau tidak valid.');
            }

            if ($obligation) {
                if (! $this->isObligationDestinationComplete($obligation) || (float) $obligation->amount <= 0) {
                    throw new DomainException('Tujuan refund belum lengkap atau tidak valid.');
                }
            } elseif (! $this->isDestinationComplete($locked) || (float) $locked->refund_amount <= 0) {
                throw new DomainException('Tujuan refund belum lengkap atau tidak valid.');
            }

            $ageingThreshold = now()->subHours((int) config('doku.refund_ageing_hours', 24));
            if ($obligation?->requested_at?->lte($ageingThreshold)) {
                app(PaymentObservabilityService::class)->event('refund_ageing', [
                    'order_id' => $locked->id,
                    'attempt_id' => $obligation?->payment_attempt_id,
                    'invoice_number' => $locked->order_code,
                    'request_id' => $obligation?->paymentAttempt?->merchant_request_id,
                    'processing_result' => 'refund_processing',
                    'error_reason' => 'age_threshold_breached',
                ]);
            }
            if ($obligation) {
                $startedAt = now();
                $obligation->update(['status' => 'in_progress', 'processed_by' => $ownerId, 'started_at' => $startedAt]);
            }

            $startedAt ??= now();
            $locked->update([
                'payment_status' => PaymentStatus::RefundInProgress->value,
                'refund_started_at' => $startedAt,
                'refund_started_by' => $ownerId,
            ]);

            $history = RefundStatusHistory::create([
                'order_id' => $locked->id,
                'from_status' => PaymentStatus::RefundPending->value,
                'to_status' => PaymentStatus::RefundInProgress->value,
                'event' => RefundStatusHistory::EVENT_PROCESSING_STARTED,
                'actor_type' => 'owner',
                'actor_id' => $ownerId,
                'metadata' => ['destination_type' => $locked->refund_destination_type],
            ]);

            DB::afterCommit(fn () => $this->notifications->notifyRefundEvent($history->order->loadMissing('customer'), $history));

            return $history;
        });
    }

    public function reject(Order $order, string $reason, ?string $note, string $actorType, ?int $actorId, bool $legacyRepair = false): RefundStatusHistory
    {
        return DB::transaction(function () use ($order, $reason, $note, $actorType, $actorId, $legacyRepair) {
            $locked = Order::lockForUpdate()->findOrFail($order->id);
            $obligation = $this->canonicalObligation($locked, true);

            if ($obligation && $obligation->status?->value !== 'pending') {
                throw new DomainException('Refund yang sedang diproses harus diselesaikan atau di-rollback.');
            }
            if (! $obligation && $locked->payment_status === PaymentStatus::RefundInProgress->value) {
                throw new DomainException('Refund yang sedang diproses harus diselesaikan atau di-rollback.');
            }

            if (! $obligation && $locked->payment_status !== PaymentStatus::RefundPending->value) {
                throw new DomainException('Order ini tidak dalam antrean refund.');
            }

            $isLegacyRepair = $legacyRepair
                && $locked->refund_requested_at !== null
                && $locked->refund_requested_at->lt(Carbon::create(2026, 7, 24, 1, 0, 0, config('app.timezone')));

            if (! $isLegacyRepair && $obligation && ! $this->isObligationDestinationComplete($obligation)) {
                throw new DomainException('Tujuan refund belum lengkap atau tidak valid.');
            }
            if (! $isLegacyRepair && ! $obligation && $locked->refund_destination_status !== Order::REFUND_DESTINATION_VALID) {
                throw new DomainException('Tujuan refund belum lengkap atau tidak valid.');
            }

            if ($reason === RefundRejectionReason::Other->value && ($note === null || $note === '')) {
                throw new DomainException('Catatan diperlukan untuk alasan ini.');
            }

            $marksDestinationInvalid = in_array($reason, [
                RefundRejectionReason::InvalidDestination->value,
                RefundRejectionReason::IncompleteDestination->value,
            ], true);

            $updateData = [
                'payment_status' => PaymentStatus::RefundRejected->value,
                'refund_rejected_reason' => $reason,
                'refund_rejection_note' => $note,
                'refund_rejected_at' => now(),
                'refund_rejected_by' => $actorId,
            ];

            if ($marksDestinationInvalid) {
                $updateData['refund_destination_status'] = Order::REFUND_DESTINATION_INVALID;
            } elseif ($isLegacyRepair) {
                $updateData['refund_destination_status'] = Order::REFUND_DESTINATION_VALID;
            }

            if ($obligation) {
                $obligation->update([
                    'status' => 'rejected',
                    'rejected_at' => $obligation->rejected_at ?? now(),
                    'metadata' => array_merge($obligation->metadata ?? [], [
                        'rejection_reason' => $reason,
                        'rejection_note' => $note,
                    ]),
                ]);
            }

            $locked->update($updateData);

            $history = RefundStatusHistory::create([
                'order_id' => $locked->id,
                'from_status' => PaymentStatus::RefundPending->value,
                'to_status' => PaymentStatus::RefundRejected->value,
                'event' => RefundStatusHistory::EVENT_REFUND_REJECTED,
                'actor_type' => $actorType,
                'actor_id' => $actorId,
                'reason_code' => $reason,
                'note' => $note,
            ]);

            DB::afterCommit(fn () => $this->notifications->notifyRefundEvent($history->order->loadMissing('customer'), $history));

            return $history;
        });
    }

    public function rollback(Order $order, int $ownerId, string $mode, string $reason): RefundStatusHistory
    {
        if (! in_array($mode, ['retry', 'fix_destination'], true)) {
            throw new DomainException('Mode rollback tidak valid.');
        }

        $trimmed = trim($reason);
        if ($trimmed === '' || mb_strlen($trimmed) > 500) {
            throw new DomainException('Alasan rollback tidak valid.');
        }

        return DB::transaction(function () use ($order, $ownerId, $mode, $trimmed) {
            $locked = Order::lockForUpdate()->findOrFail($order->id);
            $obligation = $this->canonicalObligation($locked, true);

            if ($obligation && $obligation->status?->value !== 'in_progress') {
                throw new DomainException('Refund sudah tidak dalam status diproses.');
            }

            if (! $obligation && $locked->payment_status !== PaymentStatus::RefundInProgress->value) {
                throw new DomainException('Refund sudah tidak dalam status diproses.');
            }

            if ($obligation) {
                $this->obligations->transition($obligation, RefundObligationStatus::Pending, [
                    'event' => 'processing_rolled_back',
                    'rollback_mode' => $mode,
                    'started_at' => null,
                ]);
            }

            $locked->update([
                'payment_status' => PaymentStatus::RefundPending->value,
                'refund_started_at' => null,
                'refund_started_by' => null,
                'refund_destination_status' => $mode === 'retry'
                    ? Order::REFUND_DESTINATION_VALID
                    : Order::REFUND_DESTINATION_INVALID,
            ]);

            $history = RefundStatusHistory::create([
                'order_id' => $locked->id,
                'from_status' => PaymentStatus::RefundInProgress->value,
                'to_status' => PaymentStatus::RefundPending->value,
                'event' => RefundStatusHistory::EVENT_PROCESSING_ROLLED_BACK,
                'actor_type' => 'owner',
                'actor_id' => $ownerId,
                'note' => $trimmed,
                'metadata' => ['rollback_mode' => $mode],
            ]);

            DB::afterCommit(fn () => $this->notifications->notifyRefundEvent($history->order->loadMissing('customer'), $history));

            return $history;
        });
    }

    public function complete(Order $order, int $ownerId, string $proofPath, ?string $transferReference, ?string $transferNote): RefundStatusHistory
    {
        $prefix = "private:refund-proofs/{$order->id}/";
        if (! Str::startsWith($proofPath, $prefix)) {
            throw new DomainException('Path bukti refund tidak valid.');
        }

        return DB::transaction(function () use ($order, $ownerId, $proofPath, $transferReference, $transferNote) {
            $locked = Order::lockForUpdate()->findOrFail($order->id);
            $obligation = $this->canonicalObligation($locked, true);

            if ($obligation && $obligation->status?->value !== 'in_progress') {
                throw new DomainException('Refund sudah tidak dalam status diproses.');
            }

            if (! $obligation && $locked->payment_status !== PaymentStatus::RefundInProgress->value) {
                throw new DomainException('Refund sudah tidak dalam status diproses.');
            }

            if ($obligation) {
                if ((float) $obligation->amount <= 0) {
                    throw new DomainException('Jumlah refund tidak valid.');
                }
            } elseif ((float) $locked->refund_amount <= 0) {
                throw new DomainException('Jumlah refund tidak valid.');
            }

            if ($obligation) {
                $completedAt = now();
                $obligation->update([
                    'status' => 'completed',
                    'proof_image' => $proofPath,
                    'transfer_reference' => $transferReference,
                    'transfer_note' => $transferNote,
                    'processed_by' => $ownerId,
                    'completed_at' => $completedAt,
                    'processed_at' => $completedAt,
                ]);
            }

            $locked->update([
                'payment_status' => PaymentStatus::Refunded->value,
                'refund_proof_image' => $proofPath,
                'refund_transfer_reference' => $transferReference,
                'refund_transfer_note' => $transferNote,
                'refunded_by' => $ownerId,
                'refunded_at' => now(),
            ]);

            $history = RefundStatusHistory::create([
                'order_id' => $locked->id,
                'from_status' => PaymentStatus::RefundInProgress->value,
                'to_status' => PaymentStatus::Refunded->value,
                'event' => RefundStatusHistory::EVENT_REFUND_COMPLETED,
                'actor_type' => 'owner',
                'actor_id' => $ownerId,
                'metadata' => [
                    'proof_present' => $proofPath !== null,
                    'reference_present' => $transferReference !== null,
                ],
            ]);

            DB::afterCommit(fn () => $this->notifications->notifyRefundEvent($history->order->loadMissing('customer'), $history));

            return $history;
        });
    }

    public function startAndComplete(Order $order, int $actorId, string $proofPath, ?string $transferRef, ?string $transferNote): RefundStatusHistory
    {
        return DB::transaction(function () use ($order, $actorId, $proofPath, $transferRef, $transferNote) {
            $locked = Order::lockForUpdate()->findOrFail($order->id);
            $obligation = $this->canonicalObligation($locked, true);

            if ($obligation && $obligation->status?->value === 'pending') {
                $this->start($order, $actorId);
                $locked->refresh();
            } elseif (! $obligation && $locked->payment_status === PaymentStatus::RefundPending->value) {
                $this->start($order, $actorId);
                $locked->refresh();
            }

            if ($obligation) {
                $obligation = $this->canonicalObligation($locked, true);
                if ($obligation?->status?->value !== 'in_progress') {
                    throw new DomainException('Order ini tidak dalam status refund yang bisa diselesaikan.');
                }
            } elseif ($locked->payment_status !== PaymentStatus::RefundInProgress->value) {
                throw new DomainException('Order ini tidak dalam status refund yang bisa diselesaikan.');
            }

            return $this->complete($order, $actorId, $proofPath, $transferRef, $transferNote);
        });
    }

    private function canonicalObligation(Order $order, bool $lock = false): ?RefundObligation
    {
        $query = RefundObligation::query()
            ->where('reason', $order->refund_reason)
            ->whereHas('paymentAttempt', fn ($attempt) => $attempt
                ->where('order_id', $order->id)
                ->where(function ($metadata): void {
                    $metadata->whereNull('metadata->provenance')
                        ->orWhere('metadata->provenance', '!=', 'synthetic_legacy_refund');
                }));

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query
            ->orderByDesc(PaymentAttempt::query()->select('id')->whereColumn('payment_attempts.id', 'refund_obligations.payment_attempt_id'))
            ->orderByDesc('refund_obligations.id')
            ->first();
    }

    private function isObligationDestinationComplete(RefundObligation $obligation): bool
    {
        if ($obligation->destination_type === 'bank') {
            return ! empty($obligation->bank_name) && ! empty($obligation->account_number) && ! empty($obligation->account_holder);
        }

        if ($obligation->destination_type === 'ewallet') {
            return ! empty($obligation->ewallet_provider) && ! empty($obligation->ewallet_number) && ! empty($obligation->ewallet_holder);
        }

        return false;
    }

    private function isDestinationComplete(Order $order): bool
    {
        if ($order->refund_destination_type === 'bank') {
            return ! empty($order->refund_bank_name)
                && ! empty($order->refund_account_number)
                && ! empty($order->refund_account_holder);
        }

        if ($order->refund_destination_type === 'ewallet') {
            return ! empty($order->refund_ewallet_provider)
                && ! empty($order->refund_ewallet_number)
                && ! empty($order->refund_ewallet_holder);
        }

        return false;
    }

    private function computeTrustedPaidAmount(Order $order): float
    {
        $successfulTransactions = $order->paymentTransactions
            ->whereIn('status', ['paid', 'settled']);

        if ($successfulTransactions->isNotEmpty()) {
            return (float) $successfulTransactions->max('amount');
        }

        if ($order->paid_at !== null) {
            return (float) $order->total;
        }

        return 0.0;
    }

    private function validateDestinationData(string $destinationType, array $data): void
    {
        if ($destinationType === 'bank') {
            if (empty($data['bank_name']) || empty($data['account_number']) || empty($data['account_holder'])) {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }
        } elseif ($destinationType === 'ewallet') {
            if (empty($data['ewallet_provider']) || empty($data['ewallet_number']) || empty($data['ewallet_holder'])) {
                throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
            }
        } else {
            throw new DomainException('Tujuan refund tidak dapat diubah pada status ini.');
        }
    }

    private function obligationDestinationData(string $destinationType, array $data): array
    {
        if ($destinationType === 'bank') {
            return [
                'destination_type' => 'bank', 'bank_name' => $data['bank_name'],
                'account_number' => $data['account_number'], 'account_holder' => $data['account_holder'],
                'ewallet_provider' => null, 'ewallet_number' => null, 'ewallet_holder' => null,
                'destination_submitted_at' => now(),
            ];
        }

        return [
            'destination_type' => 'ewallet', 'bank_name' => null,
            'account_number' => null, 'account_holder' => null,
            'ewallet_provider' => $data['ewallet_provider'], 'ewallet_number' => $data['ewallet_number'],
            'ewallet_holder' => $data['ewallet_holder'], 'destination_submitted_at' => now(),
        ];
    }

    private function buildDestinationUpdateData(string $destinationType, array $data): array
    {
        $base = [
            'refund_destination_type' => $destinationType,
            'refund_destination_submitted_at' => now(),
        ];

        if ($destinationType === 'bank') {
            return array_merge($base, [
                'refund_bank_name' => $data['bank_name'],
                'refund_account_number' => $data['account_number'],
                'refund_account_holder' => $data['account_holder'],
                'refund_ewallet_provider' => null,
                'refund_ewallet_number' => null,
                'refund_ewallet_holder' => null,
            ]);
        }

        return array_merge($base, [
            'refund_bank_name' => null,
            'refund_account_number' => null,
            'refund_account_holder' => null,
            'refund_ewallet_provider' => $data['ewallet_provider'],
            'refund_ewallet_number' => $data['ewallet_number'],
            'refund_ewallet_holder' => $data['ewallet_holder'],
        ]);
    }
}
