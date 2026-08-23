<?php

namespace App\Services;

use App\Models\PaymentAttempt;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class DokuReconciliationService
{
    public function __construct(private DokuService $doku) {}

    public function reconcile(PaymentAttempt $attempt): TransitionResult
    {
        $attempt = $attempt->fresh();
        if (! $attempt || ! in_array($attempt->creation_state?->value, ['pending', 'unknown'], true)) {
            return new TransitionResult(false);
        }

        $metadata = $attempt->metadata ?? [];
        $count = (int) ($metadata['reconciliation_attempts'] ?? 0);
        $next = data_get($metadata, 'next_reconciliation_at');
        if ($count >= 5 || ($next && now()->lt($next))) {
            return new TransitionResult(false);
        }

        $beforeSettlement = $attempt->settlement_status?->value;
        $beforeCreation = $attempt->creation_state?->value;

        try {
            $this->doku->reconcilePaymentAttempt($attempt);
        } catch (ModelNotFoundException) {
            return new TransitionResult(false);
        }

        $attempt = $attempt->fresh();
        if (! $attempt) {
            return new TransitionResult(false);
        }

        $changed = $attempt->settlement_status?->value !== $beforeSettlement
            || $attempt->creation_state?->value !== $beforeCreation;

        return new TransitionResult(
            changed: $changed,
            fulfilmentWinner: $attempt->fulfilment_claimed_at !== null,
        );
    }
}
