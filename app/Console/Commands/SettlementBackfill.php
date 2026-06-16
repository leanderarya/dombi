<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\Settlement;
use App\Services\SettlementGeneratorService;
use Illuminate\Console\Command;

class SettlementBackfill extends Command
{
    protected $signature = 'settlement:backfill {--dry-run : Show what would be created without writing}';

    protected $description = 'Generate settlements for completed orders that have no settlement yet';

    public function handle(SettlementGeneratorService $generator): int
    {
        $dryRun = $this->option('dry-run');

        // Find all completed orders
        $completedOrders = Order::where('status', 'completed')
            ->orderBy('created_at')
            ->get();

        if ($completedOrders->isEmpty()) {
            $this->info('No completed orders found.');

            return self::SUCCESS;
        }

        $this->info("Found {$completedOrders->count()} completed orders.");

        // Group by outlet + date to find unique settlement periods
        $periods = [];
        foreach ($completedOrders as $order) {
            $key = $order->outlet_id.'_'.$order->created_at->toDateString();
            if (! isset($periods[$key])) {
                $periods[$key] = [
                    'outlet_id' => $order->outlet_id,
                    'date' => $order->created_at,
                    'order_ids' => [],
                ];
            }
            $periods[$key]['order_ids'][] = $order->id;
        }

        $this->info('Found '.count($periods).' unique outlet-date periods.');

        // Check which already have settlements
        $created = 0;
        $skipped = 0;

        foreach ($periods as $period) {
            $existing = Settlement::where('outlet_id', $period['outlet_id'])
                ->where('period_date', $period['date']->toDateString())
                ->exists();

            if ($existing) {
                $skipped++;

                continue;
            }

            $outlet = Outlet::find($period['outlet_id']);
            if (! $outlet) {
                $this->warn("Outlet #{$period['outlet_id']} not found, skipping.");

                continue;
            }

            if ($dryRun) {
                $this->line("  [DRY RUN] Would create settlement for outlet {$outlet->name} on {$period['date']->toDateString()}");
            } else {
                $settlement = $generator->generateForOutlet($outlet, $period['date']);
                if ($settlement) {
                    $this->line("  Created settlement #{$settlement->id} for {$outlet->name} on {$period['date']->toDateString()} — {$settlement->amount_due}");
                }
            }
            $created++;
        }

        $this->newLine();
        $this->info("Done. Created: {$created}, Skipped (already exists): {$skipped}");

        return self::SUCCESS;
    }
}
