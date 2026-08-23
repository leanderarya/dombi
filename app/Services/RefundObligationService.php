<?php

namespace App\Services;

use App\Enums\RefundObligationStatus;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use DomainException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class RefundObligationService
{
    public function createForAttempt(PaymentAttempt $attempt, string $reason): RefundObligation
    {
        if ((float) $attempt->amount_snapshot <= 0) {
            throw new DomainException('Refund amount must be positive.');
        }

        try {
            return RefundObligation::firstOrCreate(
                ['payment_attempt_id' => $attempt->id, 'reason' => $reason],
                ['amount' => $attempt->amount_snapshot, 'currency' => $attempt->currency_snapshot, 'status' => RefundObligationStatus::Pending]
            );
        } catch (QueryException $exception) {
            if (! $this->isDuplicateKeyException($exception)) {
                throw $exception;
            }

            return RefundObligation::where('payment_attempt_id', $attempt->id)
                ->where('reason', $reason)
                ->firstOrFail();
        }
    }

    private function isDuplicateKeyException(QueryException $exception): bool
    {
        $sqlState = (string) ($exception->errorInfo[0] ?? $exception->getCode());
        $driverCode = (string) ($exception->errorInfo[1] ?? '');

        return $sqlState === '23505'
            || in_array($driverCode, ['1062', '1555', '2067', '2627', '2601'], true);
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

        return DB::transaction(function () use ($obligation, $to, $metadata, $allowed): bool {
            $locked = RefundObligation::lockForUpdate()->findOrFail($obligation->id);
            $allowedStatuses = array_map(
                static fn (RefundObligationStatus $status): string => $status->value,
                $allowed[$locked->status->value] ?? [],
            );
            if (! in_array($to->value, $allowedStatuses, true)) {
                return false;
            }
            $locked->update(['status' => $to, 'metadata' => array_merge($locked->metadata ?? [], $metadata), 'processed_at' => $to === RefundObligationStatus::Completed ? now() : $locked->processed_at]);

            return true;
        });
    }
}
