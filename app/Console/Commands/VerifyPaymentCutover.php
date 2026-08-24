<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use App\Models\RefundObligation;
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
            $invoice = $transaction->doku_order_id ?: $transaction->order?->order_code;
            $matches = PaymentAttempt::query()->where('legacy_payment_transaction_id', $transaction->id)->get();
            if ($matches->isEmpty() && $invoice !== null) {
                $matches = PaymentAttempt::query()->whereNull('legacy_payment_transaction_id')->where('invoice_number', $invoice)->get();
            }
            if ($matches->count() > 1) {
                $errors[] = "legacy transaction {$transaction->id} invoice fallback is ambiguous";

                return;
            }
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
            $resolvedInvoice = $transaction->doku_order_id ?: $order?->order_code;
            $fieldsMatch = $attempt->order_id === $transaction->order_id
                && $attempt->invoice_number === $resolvedInvoice
                && strtoupper($attempt->currency_snapshot) === $this->legacyCurrency($transaction)
                && $this->minorUnits($attempt->amount_snapshot) === $this->minorUnits($transaction->amount)
                && $attempt->payment_method === $transaction->payment_method
                && $attempt->settlement_status?->value === $expected
                && $attempt->gateway_transaction_id === $transaction->doku_order_id
                && $attempt->session_id === $transaction->session_id
                && $attempt->token_id === $transaction->token_id;
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
                    && $obligation->currency === ($this->legacyCurrency($transaction))
                    && $obligation->destination_type === $order->refund_destination_type
                    && $this->sameSensitive($obligation->bank_name, $order->refund_bank_name)
                    && $this->sameSensitive($obligation->account_number, $order->refund_account_number)
                    && $this->sameSensitive($obligation->account_holder, $order->refund_account_holder)
                    && $this->sameSensitive($obligation->ewallet_provider, $order->refund_ewallet_provider)
                    && $this->sameSensitive($obligation->ewallet_number, $order->refund_ewallet_number)
                    && $this->sameSensitive($obligation->ewallet_holder, $order->refund_ewallet_holder)
                    && $obligation->proof_image === $order->refund_proof_image
                    && $obligation->transfer_reference === $order->doku_refund_id
                    && $obligation->transfer_note === $order->refund_transfer_note
                    && $obligation->processed_by === $order->refunded_by
                    && $this->sameTime($obligation->requested_at, $order->refund_requested_at)
                    && $this->sameTime($obligation->completed_at, $order->refunded_at)));
            if (! $refundFieldsMatch) {
                $errors[] = "legacy transaction {$transaction->id} refund obligation count/status/reason/amount/destination/proof/reference mismatch";
            }
        });
        Order::query()->where(function ($query): void {
            $query->whereNotNull('refund_reason')->orWhere('refund_amount', '>', 0);
        })->whereIn('id', PaymentTransaction::query()->select('order_id')->distinct())->each(function (Order $order) use (&$errors): void {
            $legacyAttemptIds = PaymentAttempt::query()->where('order_id', $order->id)->whereNotNull('legacy_payment_transaction_id')->pluck('id');
            $obligations = RefundObligation::query()->whereIn('payment_attempt_id', $legacyAttemptIds)->get();
            if ($legacyAttemptIds->count() !== 1 || $obligations->count() !== 1) {
                $errors[] = "refund-bearing legacy order {$order->id} requires exactly one matched obligation";
            }
        });

        if ($errors !== []) {
            $this->error(implode(PHP_EOL, $errors));

            return self::FAILURE;
        }

        $this->info('Payment parity clean; legacy writes must be disabled before read-only cutover.');

        return self::SUCCESS;
    }

    private function minorUnits(int|float|string|null $value): ?int
    {
        if ($value === null || is_float($value)) {
            return null;
        }
        $parts = array_pad(explode('.', (string) $value, 2), 2, '');

        return ((int) $parts[0] * 100) + (int) str_pad($parts[1], 2, '0');
    }

    private function legacyCurrency(PaymentTransaction $transaction): string
    {
        return strtoupper((string) (data_get($transaction->raw_response, 'order.currency') ?? data_get($transaction->raw_response, 'transaction.currency') ?? config('doku.currency', 'IDR')));
    }

    private function sameSensitive(?string $canonical, ?string $legacy): bool
    {
        return hash('sha256', (string) $canonical) === hash('sha256', (string) $legacy);
    }

    private function sameTime($canonical, $legacy): bool
    {
        return ($canonical?->toIso8601String() ?? null) === ($legacy?->toIso8601String() ?? null);
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
