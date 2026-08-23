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
        if (! $attempt->exists || ! $attempt->id || ! DB::table('payment_attempts')->where('id', $attempt->id)->whereNotNull('order_id')->whereExists(function ($query): void {
            $query->select(DB::raw(1))->from('orders')->whereColumn('orders.id', 'payment_attempts.order_id');
        })->exists()) {
            throw new DomainException('Refund obligation requires a persisted payment attempt belonging to an order.');
        }

        if (! preg_match('/^\d+(?:\.\d{1,2})?$/', (string) $attempt->amount_snapshot) || $this->toMinorUnits((string) $attempt->amount_snapshot) <= 0) {
            throw new DomainException('Refund amount must be positive.');
        }
        if (! is_string($attempt->currency_snapshot) || ! preg_match('/^[A-Z]{3}$/', $attempt->currency_snapshot)) {
            throw new DomainException('Refund currency must be three uppercase letters.');
        }

        $attributes = ['payment_attempt_id' => $attempt->id, 'reason' => $reason];
        $values = ['amount' => $attempt->amount_snapshot, 'currency' => $attempt->currency_snapshot, 'status' => RefundObligationStatus::Pending];
        for ($retry = 0; $retry < 3; $retry++) {
            try {
                return RefundObligation::firstOrCreate($attributes, $values);
            } catch (QueryException $exception) {
                if (! $this->isDuplicateKeyException($exception)) {
                    throw $exception;
                }
                usleep(10000 * ($retry + 1));
                $existing = RefundObligation::where($attributes)->first();
                if ($existing && $this->matchesCanonical($existing, $values)) {
                    return $existing;
                }
            }
        }

        return RefundObligation::where($attributes)->firstOrFail();
    }

    private function matchesCanonical(RefundObligation $obligation, array $values): bool
    {
        return $this->toMinorUnits((string) $obligation->amount) === $this->toMinorUnits((string) $values['amount'])
            && $obligation->currency === $values['currency'];
    }

    private function toMinorUnits(string $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '');

        return ((int) $whole * 100) + (int) str_pad($fraction, 2, '0');
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
