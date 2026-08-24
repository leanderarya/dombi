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
            $obligations = $attempt->refundObligations()->get();
            $legacyRefund = (float) ($order?->refund_amount ?? 0);
            $obligationAmount = (float) $obligations->sum('amount');
            $obligation = $obligations->sortByDesc('id')->first();
            $refundFieldsMatch = $obligations->count() <= 1
                && abs($legacyRefund - $obligationAmount) <= 0.01
                && (($order?->refund_reason === null && $obligation === null) || ($obligation !== null
                    && $obligation->reason === $order->refund_reason
                    && abs((float) $obligation->amount - $legacyRefund) <= 0.01
                    && $obligation->status?->value === $this->mapRefundStatus($order->payment_status)
                    && $obligation->destination_type === $order->refund_destination_type
                    && $obligation->proof_image === $order->refund_proof_image
                    && $obligation->transfer_reference === $order->doku_refund_id));
            if (! $refundFieldsMatch) {
                $errors[] = "legacy transaction {$transaction->id} refund obligation count/status/reason/amount/destination/proof/reference mismatch";
            }
        });

        if ($errors !== []) {
            $this->error(implode(PHP_EOL, $errors));

            return self::FAILURE;
        }

        $this->info('Payment parity clean; legacy writes must be disabled before read-only cutover.');

        return self::SUCCESS;
    }

    private function mapRefundStatus(?string $status): ?string
    {
        return match ($status) {
            'refund_pending' => 'pending',
            'refund_in_progress' => 'in_progress',
            'refunded' => 'completed',
            'refund_rejected' => 'rejected',
            'refund_failed' => 'needs_review',
            default => null,
        };
    }
}
