<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\Settlement;
use Carbon\CarbonInterface;

class SettlementGeneratorService
{
    /**
     * Generate or update settlement for a specific outlet on a specific date.
     * Called when an order is completed.
     */
    public function generateForOutlet(Outlet $outlet, CarbonInterface $date): ?Settlement
    {
        $periodDate = $date->toDateString();

        // Get all completed orders for this outlet on this date
        $orders = Order::where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereDate('created_at', $periodDate)
            ->get();

        if ($orders->isEmpty()) {
            return null;
        }

        $salesAmount = $orders->sum(fn (Order $o) => (float) $o->total);
        $amountDue = $orders->sum(function (Order $o) {
            return $o->items->sum(fn ($item) => (float) $item->center_price_snapshot * $item->quantity);
        });

        $dueDate = $date->copy()->addDays(7)->toDateString();

        // Immutable: only create if not exists. Never overwrite financials.
        $settlement = Settlement::firstOrCreate(
            ['outlet_id' => $outlet->id, 'period_date' => $periodDate],
            [
                'sales_amount' => $salesAmount,
                'amount_due' => $amountDue,
                'due_date' => $dueDate,
                'status' => Settlement::STATUS_GENERATED,
                'notes' => "Settlement untuk {$outlet->name} tanggal {$periodDate}",
            ],
        );

        return $settlement;
    }

    /**
     * Generate settlements for all active outlets for a given date.
     */
    public function generateForDate(CarbonInterface $date): int
    {
        $outlets = Outlet::where('status', 'active')->get();
        $count = 0;

        foreach ($outlets as $outlet) {
            if ($this->generateForOutlet($outlet, $date)) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Backfill settlements for a date range (for initial data migration).
     */
    public function backfill(CarbonInterface $from, CarbonInterface $to): int
    {
        $count = 0;
        $current = $from->copy();

        while ($current->lte($to)) {
            $count += $this->generateForDate($current);
            $current->addDay();
        }

        return $count;
    }
}
