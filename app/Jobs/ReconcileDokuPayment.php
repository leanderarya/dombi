<?php

namespace App\Jobs;

use App\Services\DokuReconciliationService;
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
        $attempt = \App\Models\PaymentAttempt::find($this->attemptId);
        if (! $attempt) {
            return;
        }

        $reconciliation->reconcile($attempt);
    }
}