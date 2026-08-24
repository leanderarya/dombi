<?php

namespace App\Jobs;

use App\Models\PaymentAttempt;
use App\Services\DokuReconciliationService;
use App\Services\PaymentObservabilityService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;

class ReconcileDokuPayment implements ShouldQueue
{
    use Dispatchable, Queueable;

    public $tries = 1;

    public function __construct(
        public int $attemptId,
    ) {}

    public function handle(DokuReconciliationService $reconciliation): void
    {
        $attempt = PaymentAttempt::find($this->attemptId);
        if (! $attempt || ! in_array($attempt->creation_state?->value, ['pending', 'unknown'], true)) {
            return;
        }

        $metadata = $attempt->metadata ?? [];
        if ((int) ($metadata['reconciliation_attempts'] ?? 0) >= 5
            || (($next = data_get($metadata, 'next_reconciliation_at')) && now()->lt($next))) {
            return;
        }

        $result = $reconciliation->reconcile($attempt);
        app(PaymentObservabilityService::class)->event('reconciliation', [
            'order_id' => $attempt->order_id,
            'attempt_id' => $attempt->id,
            'invoice_number' => $attempt->invoice_number,
            'request_id' => $attempt->merchant_request_id,
            'processing_result' => $result->changed ? 'transitioned' : 'unchanged',
            'error_reason' => $result->changed ? null : 'no_transition',
        ]);
        if (! $result->changed) {
            app(PaymentObservabilityService::class)->event('reconciliation_failure', [
                'order_id' => $attempt->order_id,
                'attempt_id' => $attempt->id,
                'invoice_number' => $attempt->invoice_number,
                'request_id' => $attempt->merchant_request_id,
                'processing_result' => 'unchanged',
                'error_reason' => 'no_transition',
            ]);
        }
    }
}
