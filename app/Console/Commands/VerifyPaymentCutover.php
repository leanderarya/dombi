<?php

namespace App\Console\Commands;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use Illuminate\Console\Command;

class VerifyPaymentCutover extends Command
{
    protected $signature = 'payments:verify-cutover';

    protected $description = 'Verify canonical payment runtime and disabled legacy writes';

    public function handle(): int
    {
        $errors = [];

        if (config('doku.legacy_writes_enabled', true) !== false) {
            $errors[] = 'legacy payment writes must resolve to PAYMENTS_LEGACY_WRITES_ENABLED=false';
        }

        PaymentAttempt::query()->each(function (PaymentAttempt $attempt) use (&$errors): void {
            $order = $attempt->order;
            if ($order === null) {
                $errors[] = "canonical attempt {$attempt->id} references missing order";
                return;
            }
            $issues = [];
            if (blank($attempt->invoice_number) || $attempt->invoice_number !== $order->order_code) {
                $issues[] = 'invoice';
            }
            if ($attempt->amount_snapshot === null || (float) $attempt->amount_snapshot !== (float) $order->total) {
                $issues[] = 'amount';
            }
            if (blank($attempt->currency_snapshot) || strtoupper($attempt->currency_snapshot) !== strtoupper((string) config('doku.currency', 'IDR'))) {
                $issues[] = 'currency';
            }
            if ($attempt->settlement_status === null || $attempt->verification_status === null) {
                $issues[] = 'state';
            }
            if ($issues !== []) {
                $errors[] = "canonical attempt {$attempt->id} has invalid order/invoice/amount/currency/state (".implode(', ', $issues).')';
            }
        });

        RefundObligation::query()->each(function (RefundObligation $obligation) use (&$errors): void {
            $attempt = $obligation->paymentAttempt;
            if ($attempt === null || $attempt->order === null) {
                $errors[] = "refund obligation {$obligation->id} references missing attempt/order";
                return;
            }
            if ((float) $obligation->amount <= 0 || blank($obligation->currency) || strtoupper($obligation->currency) !== strtoupper((string) $attempt->currency_snapshot)) {
                $errors[] = "refund obligation {$obligation->id} has invalid amount/currency for attempt {$attempt->id}";
            }
        });

        if ($errors !== []) {
            $this->error(implode(PHP_EOL, $errors));
            return self::FAILURE;
        }

        $this->info('READY: canonical payment runtime valid and legacy writes disabled.');
        return self::SUCCESS;
    }
}
