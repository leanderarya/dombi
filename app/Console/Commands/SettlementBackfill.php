<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\Settlement;
use App\Services\SettlementGeneratorService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SettlementBackfill extends Command
{
    protected $signature = 'settlement:backfill
        {--dry-run : Show what would be created without writing}
        {--delete-old : Delete old daily settlements before regenerating}';

    protected $description = 'Generate weekly settlements for completed orders';

    public function handle(SettlementGeneratorService $generator): int
    {
        $dryRun = $this->option('dry-run');
        $deleteOld = $this->option('delete-old');

        if ($deleteOld && ! $dryRun) {
            $deleted = Settlement::where('period_type', '!=', 'weekly')->delete();
            $this->info("Deleted {$deleted} non-weekly settlements.");
        }

        // Find all completed orders grouped by outlet + ISO week
        $completedOrders = Order::where('status', 'completed')
            ->orderBy('completed_at')
            ->get();

        if ($completedOrders->isEmpty()) {
            $this->info('No completed orders found.');

            return self::SUCCESS;
        }

        $this->info("Found {$completedOrders->count()} completed orders.");

        // Group by outlet + ISO week
        $periods = [];
        foreach ($completedOrders as $order) {
            $completedAt = $order->completed_at ?? $order->created_at;
            if (! $completedAt) {
                continue;
            }
            $weekStart = $completedAt->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
            $key = $order->outlet_id.'_'.$weekStart;

            if (! isset($periods[$key])) {
                $periods[$key] = [
                    'outlet_id' => $order->outlet_id,
                    'date' => $completedAt,
                    'week_start' => $weekStart,
                ];
            }
        }

        $this->info('Found '.count($periods).' unique outlet-week periods.');

        $created = 0;
        $skipped = 0;

        foreach ($periods as $period) {
            $existing = Settlement::where('outlet_id', $period['outlet_id'])
                ->where('period_type', 'weekly')
                ->where('period_start', $period['week_start'])
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
                $this->line("  [DRY RUN] Would create weekly settlement for {$outlet->name} week {$period['week_start']}");
            } else {
                $settlement = $generator->generateForOutlet($outlet, $period['date']);
                if ($settlement) {
                    $this->line("  Created settlement #{$settlement->id} for {$outlet->name} — {$settlement->period_label} — {$settlement->amount_due}");
                }
            }
            $created++;
        }

        $this->newLine();
        $this->info("Done. Created: {$created}, Skipped (already exists): {$skipped}");

        return self::SUCCESS;
    }
}
