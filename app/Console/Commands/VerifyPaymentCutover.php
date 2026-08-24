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
        if (filter_var(env('PAYMENTS_LEGACY_WRITES_ENABLED', 'true'), FILTER_VALIDATE_BOOLEAN)) {
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
            if ((string) $attempt->amount_snapshot !== (string) $transaction->amount || $attempt->settlement_status?->value !== $expected) {
                $errors[] = "legacy transaction {$transaction->id} amount/status mismatch";
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
