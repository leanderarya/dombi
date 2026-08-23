<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
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
        $requiredColumns = ['payment_status', 'refund_amount', 'refund_reason', 'refunded_by'];
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
            ->whereNotNull('refund_amount')
            ->where('refund_amount', '>', 0)
            ->get(['id', 'payment_status', 'refund_amount', 'refund_reason', 'refund_destination_type', 'refund_bank_name', 'refund_account_number', 'refund_account_holder', 'refund_ewallet_provider', 'refund_ewallet_number', 'refund_ewallet_holder', 'refund_destination_submitted_at', 'refund_transfer_reference', 'refund_transfer_note', 'refund_proof_image', 'refunded_by', 'refunded_at']);

        foreach ($refunds as $refund) {
            DB::transaction(function () use ($refund): void {
                $orderColumns = ['id', 'total'];
                $orderCurrencyColumn = collect(['currency', 'currency_code'])->first(fn (string $column): bool => Schema::hasColumn('orders', $column));
                if ($orderCurrencyColumn) {
                    $orderColumns[] = $orderCurrencyColumn;
                }
                $order = DB::table('orders')->where('id', $refund->id)->lockForUpdate()->first($orderColumns);
                $attempt = DB::table('payment_attempts')
                    ->where('order_id', $refund->id)
                    ->where('amount_snapshot', '>=', $refund->refund_amount)
                    ->where('amount_snapshot', '>', 0)
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->first();

                if (! $attempt) {
                    if ($order && (float) $order->total > 0 && (float) $order->total !== (float) $refund->refund_amount) {
                        $this->recordException($refund, 'refund_amount_mismatch_order_total');

                        return;
                    } elseif ($order && (float) $order->total > 0) {
                        $currency = $orderCurrencyColumn ? $order->{$orderCurrencyColumn} : 'IDR';
                        if (! $currency) {
                            $this->recordException($refund, 'missing_currency');

                            return;
                        }
                        $values = [
                            'order_id' => $order->id,
                            'attempt_key' => 'legacy-refund-'.$order->id,
                            'invoice_number' => 'legacy-refund-invoice-'.$order->id,
                            'merchant_request_id' => 'legacy-refund-request-'.$order->id,
                            'amount_snapshot' => $order->total,
                            'currency_snapshot' => $orderCurrencyColumn ? $order->{$orderCurrencyColumn} : 'IDR',
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
                    }
                }

                if (! $attempt) {
                    $this->recordException($refund, 'missing_defensible_payment_attempt');

                    return;
                }

                $attemptAmount = (float) $attempt->amount_snapshot;
                $refundAmount = (float) $refund->refund_amount;
                if ($refundAmount > $attemptAmount) {
                    $this->recordException($refund, 'refund_exceeds_attempt_amount');

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

                $obligation = [
                    'payment_attempt_id' => $attempt->id,
                    'amount' => $refund->refund_amount,
                    'currency' => $attempt->currency_snapshot,
                    'reason' => $refund->refund_reason ?: 'historical_refund',
                    'status' => $status,
                    'destination_type' => $refund->refund_destination_type,
                    'bank_name' => $refund->refund_bank_name,
                    'account_number' => $refund->refund_account_number,
                    'account_holder' => $refund->refund_account_holder,
                    'ewallet_provider' => $refund->refund_ewallet_provider,
                    'ewallet_number' => $refund->refund_ewallet_number,
                    'ewallet_holder' => $refund->refund_ewallet_holder,
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
                }
            });
        }
    }

    public function down(): void
    {
        DB::table('refund_obligations')
            ->whereJsonContains('metadata->backfill_run_key', self::RUN_KEY)
            ->delete();

        DB::table('payment_attempts')
            ->where('attempt_key', 'like', 'legacy-refund-%')
            ->whereJsonContains('metadata->backfill_run_key', self::RUN_KEY)
            ->delete();

        DB::table('refund_obligation_backfill_exceptions')
            ->where('backfill_run_key', self::RUN_KEY)
            ->delete();
    }
};
