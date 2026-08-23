<?php

namespace App\Services;

use App\Enums\RefundObligationStatus;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use DomainException;
use Illuminate\Support\Facades\DB;

class RefundObligationService
{
    public function createForAttempt(PaymentAttempt $attempt, string $reason): RefundObligation
    {
        if ((float) $attempt->amount_snapshot <= 0) {
            throw new DomainException('Refund amount must be positive.');
        }

        return RefundObligation::firstOrCreate(
            ['payment_attempt_id' => $attempt->id, 'reason' => $reason],
            ['amount' => $attempt->amount_snapshot, 'currency' => $attempt->currency_snapshot, 'status' => RefundObligationStatus::Pending]
        );
    }

    public function transition(RefundObligation $obligation, RefundObligationStatus $to, array $metadata = []): bool
    {
        $allowed = [
            RefundObligationStatus::Pending->value => [RefundObligationStatus::InProgress, RefundObligationStatus::Rejected, RefundObligationStatus::NeedsReview],
            RefundObligationStatus::InProgress->value => [RefundObligationStatus::Completed, RefundObligationStatus::Failed, RefundObligationStatus::NeedsReview],
            RefundObligationStatus::Failed->value => [RefundObligationStatus::Pending, RefundObligationStatus::NeedsReview],
            RefundObligationStatus::Rejected->value => [RefundObligationStatus::Pending, RefundObligationStatus::NeedsReview],
            RefundObligationStatus::NeedsReview->value => [RefundObligationStatus::Pending, RefundObligationStatus::InProgress, RefundObligationStatus::Rejected],
            RefundObligationStatus::Completed->value => [],
        ];

        if (! in_array($to, $allowed[$obligation->status->value] ?? [], true)) {
            return false;
        }

        return DB::transaction(function () use ($obligation, $to, $metadata): bool {
            $locked = RefundObligation::lockForUpdate()->findOrFail($obligation->id);
            if (! in_array($to, [RefundObligationStatus::Pending, RefundObligationStatus::InProgress, RefundObligationStatus::Completed, RefundObligationStatus::Rejected, RefundObligationStatus::Failed, RefundObligationStatus::NeedsReview], true)) {
                return false;
            }
            $locked->update(['status' => $to, 'metadata' => array_merge($locked->metadata ?? [], $metadata), 'processed_at' => $to === RefundObligationStatus::Completed ? now() : $locked->processed_at]);

            return true;
        });
    }
}
