<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillPaymentAttempts extends Command
{
    protected $signature = 'payments:backfill-attempts';

    protected $description = 'Backfill payment attempts from legacy payment transactions';

    public function handle(): int
    {
        PaymentTransaction::query()->orderBy('id')->each(function (PaymentTransaction $transaction): void {
            $invoiceNumber = $transaction->doku_order_id
                ?: Order::query()->whereKey($transaction->order_id)->value('order_code');

            if (! $invoiceNumber) {
                $this->warn("Payment transaction {$transaction->id} could not be mapped");

                return;
            }

            $legacyKey = "legacy-payment-transaction-{$transaction->id}";
            $status = match ($transaction->status) {
                'paid', 'settled' => 'paid',
                'failed' => 'failed',
                'expired' => 'expired',
                default => 'pending',
            };

            $attempt = PaymentAttempt::query()->firstOrNew([
                'legacy_payment_transaction_id' => $transaction->id,
            ]);
            $attempt->fill([
                'order_id' => $transaction->order_id,
                'attempt_key' => $legacyKey,
                'invoice_number' => $invoiceNumber,
                'merchant_request_id' => $transaction->doku_order_id ?: $legacyKey,
                'session_token' => $transaction->session_id ?: $transaction->token_id,
                'payment_method' => $transaction->payment_method,
                'amount_snapshot' => $transaction->amount,
                'currency_snapshot' => 'IDR',
                'gateway_amount' => $transaction->amount,
                'gateway_currency' => 'IDR',
                'gateway_transaction_id' => $transaction->doku_order_id,
                'gateway_status' => $transaction->status,
                'creation_state' => 'unknown',
                'settlement_status' => $status,
                'verification_status' => 'needs_review',
                'metadata' => ['legacy_raw_response' => $transaction->raw_response],
                'created_at' => $transaction->getRawOriginal('created_at'),
                'updated_at' => $transaction->getRawOriginal('updated_at'),
            ]);
            $attempt->setRawAttributes(array_merge($attempt->getAttributes(), [
                'created_at' => $transaction->getRawOriginal('created_at'),
                'updated_at' => $transaction->getRawOriginal('updated_at'),
            ]));
            $attempt->timestamps = false;
            $attempt->save();
            DB::table('payment_attempts')->where('id', $attempt->id)->update([
                'created_at' => $transaction->getRawOriginal('created_at'),
                'updated_at' => $transaction->getRawOriginal('updated_at'),
            ]);
        });

        $this->info('Payment attempt backfill complete.');

        return self::SUCCESS;
    }
}
