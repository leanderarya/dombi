<?php

namespace App\Services;

use App\Models\Delivery;
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

        // 1. Online outlet share = Σ(selling_price_snapshot - center_price_snapshot) per item
        $onlineOutletShare = $orders->sum(function (Order $o) {
            return $o->items->sum(function ($item) {
                $selling = (float) ($item->selling_price_snapshot ?? 0);
                $center = (float) ($item->center_price_snapshot ?? 0);

                return ($selling - $center) * $item->quantity;
            });
        });

        // 2. Delivery costs = Σ(courier_cost) for ALL deliveries (dombi + eksternal)
        // Owner pays all courier salaries, so all costs are deducted from outlet share
        $orderIds = $orders->pluck('id');
        $deliveryCostTotal = $orderIds->isNotEmpty()
            ? (float) Delivery::whereIn('order_id', $orderIds)
                ->where('status', 'delivered')
                ->sum('courier_cost')
            : 0.0;

        // 3. Refunds = Σ(refund_amount) for orders refunded this week
        // Approach A: refund potong minggu refund diproses
        $refundTotal = (float) Order::where('outlet_id', $outlet->id)
            ->whereIn('payment_status', ['refunded', 'refund_in_progress'])
            ->whereNotNull('refund_amount')
            ->where('refund_amount', '>', 0)
            ->whereDate('refund_requested_at', '>=', $weekStart)
            ->whereDate('refund_requested_at', '<=', $weekEnd)
            ->sum('refund_amount');

        // 4. Offline sales = Σ(center_price * qty) — money received by outlet, must be remitted
        $offlineSalesTotal = $offlineSales->sum(fn (OfflineSale $s) => (float) $s->center_price * $s->quantity);

        // 5. Net calculation
        $netAmount = ($onlineOutletShare - $deliveryCostTotal - $refundTotal) - $offlineSalesTotal;

        // 6. Direction
        $direction = $netAmount >= 0
            ? Settlement::DIRECTION_OWNER_PAYS
            : Settlement::DIRECTION_OUTLET_PAYS;

        // 7. amount_due = abs(net) for backward compat with payment flow
        $amountDue = abs($netAmount);

        // Total sales for display (online + offline revenue)
        $salesAmount = $orders->sum(fn (Order $o) => (float) $o->total - (float) $o->delivery_fee) + $offlineSalesTotal;

        // Delivery fee from orders (for display)
        $deliveryFeeTotal = $orders->sum(fn (Order $o) => (float) $o->delivery_fee);

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
                'total_online_share' => $onlineOutletShare,
                'total_delivery_cost' => $deliveryCostTotal,
                'total_refund' => $refundTotal,
                'total_offline_sales' => $offlineSalesTotal,
                'net_amount' => $netAmount,
                'direction' => $direction,
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
                $this->notificationService->notifySettlementGenerated($settlement);
            }
            $settlement = Settlement::lockForUpdate()->find($settlement->id);
            $settlement->recalculateStatus();
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
