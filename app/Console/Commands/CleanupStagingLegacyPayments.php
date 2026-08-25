<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupStagingLegacyPayments extends Command
{
    protected $signature = 'payments:cleanup-staging-legacy {--confirm-staging}';

    protected $description = 'Delete legacy payment data from staging only';

    public function handle(): int
    {
        if (config('app.env') !== 'staging') {
            $this->error('Refused: environment must be staging.');
            return self::FAILURE;
        }

        $configured = DB::connection()->getDatabaseName();
        $expected = config('database.staging_database_name') ?: env('STAGING_DATABASE_NAME');
        if (blank($expected) || $configured !== $expected) {
            $this->error('Refused: database identity does not match configured staging database identity.');
            return self::FAILURE;
        }

        if (! $this->option('confirm-staging')) {
            $this->error('Refused: pass --confirm-staging to delete staging legacy payment data.');
            return self::FAILURE;
        }

        try {
            return DB::transaction(function (): int {
            $transactions = DB::table('payment_transactions')->count();
            $orders = DB::table('orders')->where(function ($query): void {
                $query->whereNotNull('payment_status')->orWhereNotNull('doku_order_id')->orWhereNotNull('paid_at');
            })->count();
            $this->info("payment transaction rows: {$transactions}");
            $this->info("legacy order payment rows: {$orders}");
            DB::table('payment_transactions')->delete();
            DB::table('orders')
                ->whereNotExists(function ($query): void {
                    $query->select(DB::raw(1))
                        ->from('payment_attempts')
                        ->whereColumn('payment_attempts.order_id', 'orders.id');
                })
                ->update([
                    'payment_status' => null,
                    'doku_order_id' => null,
                    'paid_at' => null,
                ]);
            if (config('database.cleanup_staging_legacy_force_failure')) {
                throw new \RuntimeException('forced cleanup failure');
            }
            $this->info('Staging legacy payment cleanup complete.');
                return self::SUCCESS;
            });
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        }
    }
}
