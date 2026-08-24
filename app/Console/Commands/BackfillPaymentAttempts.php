<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class BackfillPaymentAttempts extends Command
{
    private const STATUS_MAP = [
        'pending' => 'pending',
        'paid' => 'paid',
        'settled' => 'paid',
        'expired' => 'expired',
        'failed' => 'failed',
    ];

    protected $signature = 'payments:backfill-attempts {--dry-run : Report rows without writing}';

    protected $description = 'Backfill payment attempts from legacy payment transactions';

    public function handle(): int
    {
        $exceptions = [];

        PaymentTransaction::query()->orderBy('id')->chunkById(100, function ($transactions) use (&$exceptions): void {
            DB::transaction(function () use ($transactions, &$exceptions): void {
                foreach ($transactions as $transaction) {
                    $status = self::STATUS_MAP[$transaction->status] ?? null;
                    if ($status === null) {
                        $exceptions[] = "Payment transaction {$transaction->id} has unsupported status [{$transaction->status}]";
                        $this->warn(end($exceptions));

                        continue;
                    }

                    $orderExists = Order::query()->whereKey($transaction->order_id)->exists();
                    if (! $orderExists) {
                        $exceptions[] = "Payment transaction {$transaction->id} could not be mapped";
                        $this->warn(end($exceptions));

                        continue;
                    }

                    $orderCode = Order::query()->whereKey($transaction->order_id)->value('order_code');
                    if ($this->option('dry-run')) {
                        $exists = PaymentAttempt::query()->where('legacy_payment_transaction_id', $transaction->id)->exists();
                        $this->line("DRY RUN transaction={$transaction->id} order={$transaction->order_id} status={$status} existing_attempt=".($exists ? 'yes' : 'no'));

                        continue;
                    }

                    try {
                        DB::transaction(function () use ($transaction, $orderCode, $status): void {
                            $attempt = PaymentAttempt::query()->firstOrNew([
                                'legacy_payment_transaction_id' => $transaction->id,
                            ]);
                            if ($attempt->exists) {
                                return;
                            }

                            $identity = "legacy-payment-transaction-{$transaction->id}";
                            $attempt->fill([
                                'order_id' => $transaction->order_id,
                                'attempt_key' => "legacy-attempt-{$transaction->id}",
                                'invoice_number' => $transaction->doku_order_id ?: ($orderCode ?: "legacy-invoice-{$transaction->id}"),
                                'merchant_request_id' => $transaction->doku_order_id ?: "legacy-request-{$transaction->id}",
                                'session_token' => $transaction->session_id ?: $transaction->token_id,
                                'session_id' => $transaction->session_id,
                                'token_id' => $transaction->token_id,
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
                                'metadata' => array_filter([
                                    'legacy_identity' => $identity,
                                    'legacy_order_code' => $orderCode,
                                ]),
                                'raw_response' => $transaction->raw_response,
                            ]);
                            $attempt->timestamps = false;
                            $attempt->save();
                            DB::table('payment_attempts')->where('id', $attempt->id)->update([
                                'created_at' => $transaction->getRawOriginal('created_at'),
                                'updated_at' => $transaction->getRawOriginal('updated_at'),
                            ]);
                        });
                    } catch (Throwable $exception) {
                        $exceptions[] = "Payment transaction {$transaction->id} failed: {$exception->getMessage()}";
                        $this->warn(end($exceptions));
                    }
                }
            });
        });

        $report = "Payment attempt backfill exceptions\n".implode("\n", $exceptions)."\n";
        Storage::disk('local')->put('payment-attempt-backfill-exceptions.txt', $report);
        $this->info('Payment attempt backfill complete.');
        $this->info('Exceptions: '.count($exceptions));

        return self::SUCCESS;
    }
}
