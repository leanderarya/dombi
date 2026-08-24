<?php

namespace App\Console\Commands;

use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use Illuminate\Console\Command;

class VerifyPaymentCutover extends Command
{
    protected $signature = 'payments:verify-cutover';

    protected $description = 'Verify payment migration parity and legacy write cutover';

    public function handle(): int
    {
        $errors = [];
        if (config('doku.legacy_writes_enabled', true)) {
            $errors[] = 'legacy payment writes are enabled';
        }
        PaymentTransaction::query()->each(function (PaymentTransaction $transaction) use (&$errors): void {
            $matches = PaymentAttempt::query()->where('legacy_payment_transaction_id', $transaction->id)->get();
            if ($matches->count() !== 1) {
                $errors[] = "legacy transaction {$transaction->id} requires exactly one attempt";

                return;
            }
            $attempt = $matches->sole();
            $expected = match ($transaction->status) {
                'settled' => 'paid',
                default => $transaction->status,
            };
            $order = $transaction->order;
            $fieldsMatch = $attempt->order_id === $transaction->order_id
                && $attempt->invoice_number === $transaction->doku_order_id
                && strtoupper($attempt->currency_snapshot) === 'IDR'
                && (string) $attempt->amount_snapshot === (string) $transaction->amount
                && $attempt->settlement_status?->value === $expected
                && $attempt->gateway_transaction_id === $transaction->doku_order_id;
            if (! $fieldsMatch) {
                $errors[] = "legacy transaction {$transaction->id} attempt/order/invoice/currency/amount/status/gateway identity mismatch";
            }
            $legacyRefund = (float) ($order?->refund_amount ?? 0);
            $obligationAmount = (float) $attempt->refundObligations()->sum('amount');
            if (abs($legacyRefund - $obligationAmount) > 0.01) {
                $errors[] = "legacy transaction {$transaction->id} refund obligation amount mismatch";
            }
        });

        if ($errors !== []) {
            $this->error(implode(PHP_EOL, $errors));

            return self::FAILURE;
        }

        $this->info('Payment parity clean; legacy writes must be disabled before read-only cutover.');

        return self::SUCCESS;
    }
}
