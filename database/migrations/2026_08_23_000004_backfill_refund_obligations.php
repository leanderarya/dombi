<?php

use App\Models\Order;
use App\Models\RefundObligation;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const RUN_KEY = '2026_08_23_000004_refund_obligations';

    private function ensureExceptionTable(): void
    {
        if (Schema::hasTable('refund_obligation_backfill_exceptions')) {
            return;
        }

        Schema::create('refund_obligation_backfill_exceptions', function ($table): void {
            $table->id();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('reason');
            $table->string('backfill_run_key');
            $table->json('payload')->nullable();
            $table->timestamps();
            $table->unique(['order_id', 'reason', 'backfill_run_key'], 'refund_backfill_exception_key');
        });
    }

    private function recordException(object $refund, string $reason): void
    {
        $row = [
            'order_id' => $refund->id,
            'reason' => $reason,
            'backfill_run_key' => self::RUN_KEY,
            'payload' => json_encode((array) $refund),
            'created_at' => now(),
            'updated_at' => now(),
        ];
        try {
            DB::table('refund_obligation_backfill_exceptions')->insert($row);
        } catch (QueryException $exception) {
            if (! $this->isDuplicateKey($exception)) {
                throw $exception;
            }
        }
    }

    private function encryptedDestinationValues(object $refund): array
    {
        $order = Order::findOrFail($refund->id);
        $model = new RefundObligation;
        $values = [];
        foreach (['bank_name', 'account_number', 'account_holder', 'ewallet_provider', 'ewallet_number', 'ewallet_holder'] as $field) {
            $source = 'refund_'.$field;
            $raw = $refund->{$source};
            $model->{$field} = $raw === null ? null : Crypt::decryptString($raw);
            $values[$field] = $model->getRawOriginal($field);
        }

        return $values;
    }

    private function toMinorUnits(mixed $amount): int
    {
        if (! is_string($amount) && ! is_int($amount) && ! is_float($amount)) {
            return 0;
        }
        $value = (string) $amount;
        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');
        $fraction = str_pad(substr($fraction, 0, 2), 2, '0');

        return ((int) $whole * 100) + (int) $fraction;
    }

    private function isDuplicateKey(QueryException $exception): bool
    {
        $sqlState = (string) ($exception->errorInfo[0] ?? $exception->getCode());
        $driverCode = (string) ($exception->errorInfo[1] ?? '');

        return $sqlState === '23505'
            || ($sqlState === '23000' && $driverCode === '19')
            || in_array($driverCode, ['1062', '2627', '2601'], true);
    }

    public function up(): void
    {
        if (! Schema::hasTable('orders') || ! Schema::hasTable('refund_obligations') || ! Schema::hasTable('payment_attempts')) {
            return;
        }
        $requiredColumns = [
            'payment_status', 'refund_amount', 'refund_reason', 'refunded_by', 'total',
            'refund_destination_type', 'refund_bank_name', 'refund_account_number', 'refund_account_holder',
            'refund_ewallet_provider', 'refund_ewallet_number', 'refund_ewallet_holder',
            'refund_destination_submitted_at', 'refund_transfer_reference', 'refund_transfer_note',
            'refund_proof_image', 'refunded_at',
        ];
        foreach ($requiredColumns as $column) {
            if (! Schema::hasColumn('orders', $column)) {
                return;
            }
        }
        if (! Schema::hasTable('users') || ! Schema::hasColumn('refund_obligations', 'processed_by')) {
            return;
        }
        $this->ensureExceptionTable();

        $refunds = DB::table('orders')
            ->whereIn('payment_status', ['refund_pending', 'refund_in_progress', 'refunded', 'refund_rejected', 'refund_failed'])
            ->get(['id', 'payment_status', 'refund_amount', 'refund_reason', 'refund_destination_type', 'refund_bank_name', 'refund_account_number', 'refund_account_holder', 'refund_ewallet_provider', 'refund_ewallet_number', 'refund_ewallet_holder', 'refund_destination_submitted_at', 'refund_transfer_reference', 'refund_transfer_note', 'refund_proof_image', 'refunded_by', 'refunded_at']);

        foreach ($refunds as $refund) {
            DB::transaction(function () use ($refund): void {
                $orderColumns = ['id', 'total'];
                $orderCurrencyColumn = collect(['currency', 'currency_code'])->first(fn (string $column): bool => Schema::hasColumn('orders', $column));
                if ($orderCurrencyColumn) {
                    $orderColumns[] = $orderCurrencyColumn;
                }
                $order = DB::table('orders')->where('id', $refund->id)->lockForUpdate()->first($orderColumns);
                $attempts = DB::table('payment_attempts')
                    ->where('order_id', $refund->id)
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->get();
                $refundAmount = $this->toMinorUnits($refund->refund_amount);
                $refundAmountValid = is_string($refund->refund_amount) && preg_match('/^\d+(?:\.\d{1,2})?$/', $refund->refund_amount) && $refundAmount > 0;
                if (! $refundAmountValid) {
                    $this->recordException($refund, 'invalid_refund_amount');

                    return;
                }
                $attempt = $attempts->first(fn ($candidate): bool => $this->toMinorUnits($candidate->amount_snapshot) >= $refundAmount && $this->toMinorUnits($candidate->amount_snapshot) > 0);

                if (! $attempt) {
                    if ($order && $this->toMinorUnits($order->total) > 0 && $this->toMinorUnits($order->total) !== $this->toMinorUnits($refund->refund_amount)) {
                        $this->recordException($refund, 'refund_amount_mismatch_order_total');

                        return;
                    } elseif ($order && $this->toMinorUnits($order->total) > 0) {
                        $currency = $orderCurrencyColumn ? $order->{$orderCurrencyColumn} : null;
                        if (! is_string($currency) || ! preg_match('/^[A-Z]{3}$/', $currency)) {
                            $this->recordException($refund, 'missing_currency');

                            return;
                        }
                        $values = [
                            'order_id' => $order->id,
                            'attempt_key' => 'legacy-refund-'.$order->id,
                            'invoice_number' => 'legacy-refund-invoice-'.$order->id,
                            'merchant_request_id' => 'legacy-refund-request-'.$order->id,
                            'amount_snapshot' => $order->total,
                            'currency_snapshot' => $currency,
                            'creation_state' => 'unknown',
                            'settlement_status' => 'unknown',
                            'verification_status' => 'needs_review',
                            'metadata' => json_encode(['synthesized_for_refund_backfill' => true, 'backfill_run_key' => self::RUN_KEY]),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                        try {
                            DB::table('payment_attempts')->insert($values);
                        } catch (QueryException $exception) {
                            if (! $this->isDuplicateKey($exception)) {
                                throw $exception;
                            }
                        }
                        $attempt = DB::table('payment_attempts')->where('attempt_key', $values['attempt_key'])->first();
                        if (! $attempt || $attempt->order_id !== $values['order_id'] || $this->toMinorUnits($attempt->amount_snapshot) !== $this->toMinorUnits($values['amount_snapshot']) || $attempt->currency_snapshot !== $values['currency_snapshot'] || ! str_contains((string) $attempt->metadata, self::RUN_KEY)) {
                            $this->recordException($refund, 'conflicting_synthesized_attempt');

                            return;
                        }
                    }
                }

                if (! $attempt) {
                    $this->recordException($refund, 'missing_defensible_payment_attempt');

                    return;
                }

                if ($this->toMinorUnits($refund->refund_amount) > $this->toMinorUnits($attempt->amount_snapshot)) {
                    $this->recordException($refund, 'refund_exceeds_attempt_amount');

                    return;
                }

                if (! is_string($attempt->currency_snapshot) || ! preg_match('/^[A-Z]{3}$/', $attempt->currency_snapshot)) {
                    $this->recordException($refund, 'missing_currency');

                    return;
                }

                if ($refund->refunded_by !== null && ! DB::table('users')->where('id', $refund->refunded_by)->exists()) {
                    $this->recordException($refund, 'invalid_refunded_by');

                    return;
                }

                $status = match ($refund->payment_status ?? null) {
                    'refunded' => 'completed',
                    'refund_in_progress' => 'in_progress',
                    'refund_rejected' => 'rejected',
                    'refund_failed' => 'failed',
                    default => 'pending',
                };

                $destinationValues = $this->encryptedDestinationValues($refund);
                $obligation = [
                    'payment_attempt_id' => $attempt->id,
                    'amount' => $refund->refund_amount,
                    'currency' => $attempt->currency_snapshot,
                    'reason' => $refund->refund_reason ?: 'historical_refund',
                    'status' => $status,
                    'destination_type' => $refund->refund_destination_type,
                    'bank_name' => $destinationValues['bank_name'],
                    'account_number' => $destinationValues['account_number'],
                    'account_holder' => $destinationValues['account_holder'],
                    'ewallet_provider' => $destinationValues['ewallet_provider'],
                    'ewallet_number' => $destinationValues['ewallet_number'],
                    'ewallet_holder' => $destinationValues['ewallet_holder'],
                    'destination_submitted_at' => $refund->refund_destination_submitted_at,
                    'transfer_reference' => $refund->refund_transfer_reference,
                    'transfer_note' => $refund->refund_transfer_note,
                    'proof_image' => $refund->refund_proof_image,
                    'processed_by' => $refund->refunded_by,
                    'processed_at' => $refund->refunded_at,
                    'metadata' => json_encode(['backfilled_from_order_id' => $refund->id, 'backfill_run_key' => self::RUN_KEY]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                try {
                    DB::table('refund_obligations')->insert($obligation);
                } catch (QueryException $queryException) {
                    if (! $this->isDuplicateKey($queryException)) {
                        throw $queryException;
                    }
                    $existing = DB::table('refund_obligations')->where('payment_attempt_id', $attempt->id)->where('reason', $obligation['reason'])->first();
                    if (! $existing || $this->toMinorUnits($existing->amount) !== $this->toMinorUnits($obligation['amount']) || $existing->currency !== $obligation['currency']) {
                        $this->recordException($refund, 'conflicting_refund_obligation');
                    }
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('refund_obligations')) {
            DB::table('refund_obligations')
                ->whereJsonContains('metadata->backfill_run_key', self::RUN_KEY)
                ->delete();
        }

        if (Schema::hasTable('payment_attempts')) {
            $attempts = DB::table('payment_attempts')
                ->where('attempt_key', 'like', 'legacy-refund-%')
                ->whereJsonContains('metadata->backfill_run_key', self::RUN_KEY)
                ->pluck('id');
            foreach ($attempts as $attemptId) {
                $hasObligations = Schema::hasTable('refund_obligations') && DB::table('refund_obligations')->where('payment_attempt_id', $attemptId)->exists();
                if (! $hasObligations) {
                    DB::table('payment_attempts')->where('id', $attemptId)->delete();
                }
            }
        }

        if (Schema::hasTable('refund_obligation_backfill_exceptions')) {
            DB::table('refund_obligation_backfill_exceptions')
                ->where('backfill_run_key', self::RUN_KEY)
                ->delete();
        }
    }
};
