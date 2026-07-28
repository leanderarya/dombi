<?php

namespace App\Services;

use App\Models\ExchangeRequest;
use App\Models\OfflineSale;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletPayable;
use App\Models\Settlement;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class SettlementGeneratorService
{
    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    /**
     * Generate or update weekly settlement for an outlet based on a completion date.
     * Groups all completed orders for that outlet within the same ISO week (Mon–Sun).
     * Called when an order is completed or an offline sale is recorded.
     */
    public function generateForOutlet(Outlet $outlet, CarbonInterface $date): ?Settlement
    {
        $weekStart = $date->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
        $weekEnd = $date->copy()->endOfWeek(Carbon::SUNDAY)->toDateString();

        // Get all completed orders for this outlet completed within this week
        // Use COALESCE to handle orders where completed_at is null (legacy data)
        $orders = Order::where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereRaw('COALESCE(completed_at, created_at) >= ?', [$weekStart])
            ->whereRaw('COALESCE(completed_at, created_at) <= ?', [$weekEnd.' 23:59:59'])
            ->get();

        // Get all offline sales for this outlet within the same week
        $offlineSales = OfflineSale::where('outlet_id', $outlet->id)
            ->whereDate('created_at', '>=', $weekStart)
            ->whereDate('created_at', '<=', $weekEnd)
            ->get();

        if ($orders->isEmpty() && $offlineSales->isEmpty()) {
            return null;
        }

        // Online orders
        $deliveryFeeTotal = $orders->sum(fn (Order $o) => (float) $o->delivery_fee);
        $salesAmount = $orders->sum(fn (Order $o) => (float) $o->total) - $deliveryFeeTotal;
        $amountDue = $orders->sum(function (Order $o) {
            return $o->items->sum(fn ($item) => ((float) ($item->center_price_snapshot ?? 0)) * $item->quantity);
        });

        // Offline sales: all revenue is center_price × qty (no delivery fee, no customer margin)
        $offlineAmount = $offlineSales->sum(fn (OfflineSale $s) => (float) $s->center_price * $s->quantity);
        $salesAmount += $offlineAmount;
        $amountDue += $offlineAmount;

        // Due date = end of week + 7 days (consistent weekly cycle)
        $dueDate = Carbon::parse($weekEnd)->addDays(7)->toDateString();

        // Upsert: recalculate from source of truth (orders + offline sales) each time
        $settlement = Settlement::updateOrCreate(
            [
                'outlet_id' => $outlet->id,
                'period_type' => 'weekly',
                'period_start' => $weekStart,
            ],
            [
                'period_date' => $weekStart, // backward compat
                'period_end' => $weekEnd,
                'sales_amount' => $salesAmount,
                'delivery_fee_amount' => $deliveryFeeTotal,
                'amount_due' => $amountDue,
                'due_date' => $dueDate,
                'notes' => "Settlement minggu {$weekStart} – {$weekEnd} untuk {$outlet->name}",
            ],
        );

        $wasRecentlyCreated = $settlement->wasRecentlyCreated;

        // Sync exchange adjustments (return adjustments are ignored - consignment model)
        $this->syncAdjustments($outlet, $date);

        // Refresh after sync (adjustment_amount may have changed)
        $settlement = Settlement::where('outlet_id', $outlet->id)
            ->where('period_type', 'weekly')
            ->where('period_start', $weekStart)
            ->first();

        if ($settlement) {
            if ($wasRecentlyCreated) {
                $settlement->status = Settlement::STATUS_GENERATED;
                $settlement->save();
                $this->notificationService->notifySettlementGenerated($settlement);
            } else {
                $settlement = Settlement::lockForUpdate()->find($settlement->id);
                $settlement->recalculateStatus();
            }
        }

        return $settlement;
    }

    /**
     * Backfill weekly settlements for a date range.
     * Scans completed orders and groups by outlet + ISO week.
     */
    public function backfill(CarbonInterface $from, CarbonInterface $to): int
    {
        $outlets = Outlet::where('status', 'active')->get();
        $count = 0;

        foreach ($outlets as $outlet) {
            // Find all unique weeks from completed orders
            $orders = Order::where('outlet_id', $outlet->id)
                ->where('status', 'completed')
                ->whereRaw('COALESCE(completed_at, created_at) >= ?', [$from->toDateString()])
                ->whereRaw('COALESCE(completed_at, created_at) <= ?', [$to->toDateString().' 23:59:59'])
                ->get();

            $orderWeeks = $orders
                ->map(fn ($o) => ($o->completed_at ?? $o->created_at)->startOfWeek(Carbon::MONDAY)->toDateString())
                ->unique();

            // Find all unique weeks from offline sales
            $offlineWeeks = OfflineSale::where('outlet_id', $outlet->id)
                ->whereDate('created_at', '>=', $from->toDateString())
                ->whereDate('created_at', '<=', $to->toDateString())
                ->get()
                ->map(fn ($s) => $s->created_at->startOfWeek(Carbon::MONDAY)->toDateString())
                ->unique();

            // Merge unique weeks from both sources
            $weeks = $orderWeeks->merge($offlineWeeks)->unique();

            foreach ($weeks as $weekStart) {
                $weekDate = Carbon::parse($weekStart);
                if ($this->generateForOutlet($outlet, $weekDate)) {
                    $count++;
                }
            }
        }

        return $count;
    }

    /**
     * Recalculate a specific weekly settlement from source orders.
     * Used after offline sale deletion or order status changes.
     */
    public function recalculateForWeek(Outlet $outlet, CarbonInterface $date): void
    {
        $this->generateForOutlet($outlet, $date);
    }

    /**
     * Sync outlet_payables adjustments (exchanges only) to settlement.adjustment_amount.
     * Return of unsold stock (consignment) must NOT affect settlement.
     * Single source of truth — called from ExchangeService and ReturnService (cleanup).
     */
    public function syncAdjustments(Outlet $outlet, CarbonInterface $date): void
    {
        $weekStart = Carbon::parse($date)->startOfWeek(Carbon::MONDAY)->toDateString();
        $weekEnd = Carbon::parse($date)->endOfWeek(Carbon::SUNDAY)->toDateString();

        // Only exchange adjustments affect settlement; return adjustments are ignored (consignment model)
        $adjustmentTotal = (float) OutletPayable::where('outlet_id', $outlet->id)
            ->where('type', 'adjustment')
            ->where('reference_type', ExchangeRequest::class)
            ->whereBetween('created_at', [$weekStart, $weekEnd.' 23:59:59'])
            ->sum('amount');

        $settlement = Settlement::where('outlet_id', $outlet->id)
            ->where('period_type', 'weekly')
            ->where('period_start', $weekStart)
            ->first();

        if ($settlement) {
            $settlement->update(['adjustment_amount' => $adjustmentTotal]);
            $settlement->recalculateStatus();
        }
    }
}
