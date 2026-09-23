<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillRefundDestinations extends Command
{
    protected $signature = 'refunds:backfill-destinations
        {--dry-run : Report how many destinations would be copied without writing}';

    protected $description = 'Copy existing order refund destinations into the append-only destination history';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $copied = 0;

        DB::table('orders')
            ->whereIn('refund_destination_type', ['bank', 'ewallet'])
            ->whereNotExists(function ($query): void {
                $query->select(DB::raw(1))
                    ->from('order_refund_destinations')
                    ->whereColumn('order_refund_destinations.order_id', 'orders.id');
            })
            ->select([
                'id', 'refund_destination_type', 'refund_bank_name', 'refund_account_number',
                'refund_account_holder', 'refund_ewallet_provider', 'refund_ewallet_number',
                'refund_ewallet_holder', 'refund_destination_submitted_at', 'created_at',
            ])
            ->orderBy('id')
            ->chunkById(200, function ($orders) use (&$copied, $dryRun): void {
                if ($dryRun) {
                    $copied += $orders->count();

                    return;
                }

                $rows = [];

                foreach ($orders as $order) {
                    $rows[] = [
                        'order_id' => $order->id,
                        'event' => 'backfilled',
                        'destination_type' => $order->refund_destination_type,
                        'bank_name' => $order->refund_bank_name,
                        'account_number' => $order->refund_account_number,
                        'account_holder' => $order->refund_account_holder,
                        'ewallet_provider' => $order->refund_ewallet_provider,
                        'ewallet_number' => $order->refund_ewallet_number,
                        'ewallet_holder' => $order->refund_ewallet_holder,
                        'actor_type' => null,
                        'actor_id' => null,
                        'created_at' => $order->refund_destination_submitted_at ?? $order->created_at,
                    ];
                }

                if ($rows !== []) {
                    DB::table('order_refund_destinations')->insert($rows);
                    $copied += count($rows);
                }
            });

        $this->info($dryRun
            ? "Would copy {$copied} refund destinations."
            : "Copied {$copied} refund destinations.");

        return self::SUCCESS;
    }
}
