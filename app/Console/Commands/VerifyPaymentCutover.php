<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use App\Models\RefundObligation;
use Carbon\Carbon;
use Illuminate\Console\Command;

class VerifyPaymentCutover extends Command
{
    protected $signature = 'payments:verify-cutover';

    protected $description = 'Verify payment migration parity and legacy write cutover';

    public function handle(): int
    {
        $errors = [];
        $evidence = config('doku.legacy_writes_deployment_evidence');
        $cutover = config('doku.payment_cutover_at');
        if ($cutover === null || trim((string) $cutover) === '') {
            $errors[] = 'runtime payment cutover timestamp must explicitly resolve PAYMENT_CUTOVER_AT';
        }
        if (config('doku.legacy_writes_enabled', true) || filter_var($evidence, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) !== false || $evidence === null) {
            $errors[] = 'runtime deployment evidence must explicitly resolve PAYMENTS_LEGACY_WRITES_ENABLED=false';
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
            if ($obligations->contains(fn (RefundObligation $obligation): bool => $obligation->paymentAttempt?->order_id !== $transaction->order_id)) {
                $errors[] = "legacy transaction {$transaction->id} obligation order/attempt mismatch";
            }
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
                    && data_get($obligation->metadata, 'destination_status') === $order->refund_destination_status
                    && data_get($obligation->metadata, 'rejection_code') === $order->refund_rejection_code
                    && data_get($obligation->metadata, 'rejected_by') === $order->refund_rejected_by
                    && $this->sameSensitive($obligation->bank_name, $order->refund_bank_name)
                    && $this->sameSensitive($obligation->account_number, $order->refund_account_number)
                    && $this->sameSensitive($obligation->account_holder, $order->refund_account_holder)
                    && $this->sameSensitive($obligation->ewallet_provider, $order->refund_ewallet_provider)
                    && $this->sameSensitive($obligation->ewallet_number, $order->refund_ewallet_number)
                    && $this->sameSensitive($obligation->ewallet_holder, $order->refund_ewallet_holder)
                    && $obligation->proof_image === $order->refund_proof_image
                    && $obligation->transfer_reference === $order->doku_refund_id
                    && $obligation->transfer_note === $order->refund_transfer_note
                    && data_get($obligation->metadata, 'completed_by') === $order->refunded_by
                    && data_get($obligation->metadata, 'started_by') === $order->refund_started_by
                    && data_get($obligation->metadata, 'rejected_by') === $order->refund_rejected_by
                    && $this->sameTime($obligation->requested_at, $order->refund_requested_at)
                    && $this->sameTime($obligation->destination_submitted_at, $order->refund_destination_submitted_at)
                    && $this->sameTime($obligation->started_at, $order->refund_started_at)
                    && $this->sameTime($obligation->completed_at, $order->refunded_at)
                    && $this->sameTime($obligation->rejected_at, $order->refund_rejected_at)
                    && data_get($obligation->metadata, 'rejection_reason') === $order->refund_rejected_reason
                    && data_get($obligation->metadata, 'rejection_note') === $order->refund_rejection_note));
            if (! $refundFieldsMatch) {
                $errors[] = "legacy transaction {$transaction->id} refund obligation count/status/reason/amount/destination/proof/reference mismatch";
            }
        });
        Order::query()->where(function ($query): void {
            $query->whereNotNull('refund_reason')
                ->orWhere('refund_amount', '>', 0)
                ->orWhereNotNull('doku_refund_id')
                ->orWhereNotNull('refund_destination_type')
                ->orWhereNotNull('refund_proof_image')
                ->orWhereNotNull('refund_requested_at')
                ->orWhereNotNull('refund_started_at')
                ->orWhereNotNull('refunded_at')
                ->orWhereNotNull('refund_rejected_at');
        })->each(function (Order $order) use (&$errors): void {
            $legacyAttemptIds = PaymentAttempt::query()->where('order_id', $order->id)->whereNotNull('legacy_payment_transaction_id')->pluck('id');
            $obligations = RefundObligation::query()->whereIn('payment_attempt_id', $legacyAttemptIds)->get();
            $hasLegacyTransaction = PaymentTransaction::query()->where('order_id', $order->id)->exists();
            if ($hasLegacyTransaction && ($legacyAttemptIds->count() !== 1 || $obligations->count() !== 1)) {
                $errors[] = "refund-bearing legacy order {$order->id} requires exactly one matched obligation";
            } elseif (! $hasLegacyTransaction && $legacyAttemptIds->isNotEmpty()) {
                $errors[] = "post-cutover refund order {$order->id} has unexpected legacy linkage";
            }
        });

        PaymentAttempt::query()->whereNotNull('legacy_payment_transaction_id')->each(function (PaymentAttempt $attempt) use (&$errors): void {
            $count = PaymentAttempt::query()->where('legacy_payment_transaction_id', $attempt->legacy_payment_transaction_id)->count();
            if (! PaymentTransaction::query()->whereKey($attempt->legacy_payment_transaction_id)->exists()) {
                $errors[] = "canonical attempt {$attempt->id} references missing legacy transaction";
            } elseif ($count !== 1) {
                $errors[] = "legacy transaction {$attempt->legacy_payment_transaction_id} maps to {$count} canonical attempts";
            }
        });
        RefundObligation::query()->each(function (RefundObligation $obligation) use (&$errors): void {
            $attempt = $obligation->paymentAttempt;
            if ($attempt === null || ! Order::query()->whereKey($attempt->order_id)->exists()) {
                $errors[] = "refund obligation {$obligation->id} has invalid attempt/order FK";
            } elseif ($attempt->legacy_payment_transaction_id !== null && ! PaymentTransaction::query()->whereKey($attempt->legacy_payment_transaction_id)->exists()) {
                $errors[] = "refund obligation {$obligation->id} has missing legacy source";
            } elseif ($attempt->legacy_payment_transaction_id === null && ! $this->isPostCutover($attempt)) {
                $errors[] = "refund obligation {$obligation->id} lacks pre-cutover legacy provenance";
            }
        });

        if ($errors !== []) {
            $this->error(implode(PHP_EOL, $errors));

            return self::FAILURE;
        }

        $this->info('READY: payment parity clean and runtime legacy-write evidence explicitly disabled.');

        return self::SUCCESS;
    }

    private function isPostCutover(PaymentAttempt $attempt): bool
    {
        $cutover = config('doku.payment_cutover_at');

        return $cutover !== null && trim((string) $cutover) !== '' && $attempt->created_at !== null && $attempt->created_at->greaterThanOrEqualTo(Carbon::parse($cutover));
    }

    private function minorUnits(int|float|string|null $value): ?int
    {
        if ($value === null) {
            return null;
        }
        if (is_float($value)) {
            return null;
        }
        $text = trim((string) $value);
        if (! preg_match('/^\d+(?:\.\d{1,2})?$/', $text)) {
            return null;
        }
        $parts = array_pad(explode('.', $text, 2), 2, '');

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
