<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\ExchangeRequest;
use App\Models\OfflineSale;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletPayable;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Models\SettlementPaymentAllocation;
use App\Models\SettlementReconciliationIssue;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

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
        return DB::transaction(function () use ($outlet, $date): ?Settlement {
            Outlet::lockForSettlement($outlet->id);

            return $this->generateForOutletLocked($outlet, $date);
        });
    }

    private function generateForOutletLocked(Outlet $outlet, CarbonInterface $date): ?Settlement
    {
        $weekStart = $date->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
        $weekEnd = $date->copy()->endOfWeek(Carbon::SUNDAY)->toDateString();

        $orders = Order::query()
            ->where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereRaw('COALESCE(completed_at, created_at) >= ?', [$weekStart])
            ->whereRaw('COALESCE(completed_at, created_at) <= ?', [$weekEnd.' 23:59:59'])
            ->get();

        $offlineSales = OfflineSale::query()
            ->where('outlet_id', $outlet->id)
            ->whereFromDay('created_at', $weekStart)
            ->whereUntilDay('created_at', $weekEnd)
            ->get();

        $adjustmentTotal = $this->adjustmentTotalForWeek($outlet, $weekStart, $weekEnd);
        $existingSettlement = Settlement::query()
            ->where('outlet_id', $outlet->id)
            ->where('period_type', 'weekly')
            ->whereDate('period_start', $weekStart)
            ->lockForUpdate()
            ->first();

        if ($orders->isEmpty() && $offlineSales->isEmpty() && ! $existingSettlement) {
            return null;
        }

        if ($orders->isEmpty() && $offlineSales->isEmpty()) {
            $sourceSnapshot = $this->zeroSourceSnapshot($adjustmentTotal);
        } else {
            $sourceSnapshot = $this->buildSourceSnapshot(
                $outlet,
                $orders,
                $offlineSales,
                $adjustmentTotal,
                $weekStart,
                $weekEnd,
            );
        }

        if ($existingSettlement && $this->hasFinancialActivity($existingSettlement)) {
            $this->recordReconciliationIssue($existingSettlement, $sourceSnapshot);

            return $existingSettlement;
        }

        if ($existingSettlement) {
            $this->resolveReconciliationIssue($existingSettlement);
        }

        if ($orders->isEmpty() && $offlineSales->isEmpty()) {
            $existingSettlement->update([
                'sales_amount' => 0,
                'delivery_fee_amount' => 0,
                'amount_due' => 0,
                'total_online_share' => 0,
                'total_delivery_cost' => 0,
                'total_refund' => 0,
                'total_offline_sales' => 0,
                'net_amount' => 0,
                'direction' => Settlement::DIRECTION_OWNER_PAYS,
                'adjustment_amount' => $adjustmentTotal,
            ]);
            $existingSettlement->recalculateStatus();

            return $existingSettlement->fresh();
        }

        $settlement = Settlement::updateOrCreate(
            [
                'outlet_id' => $outlet->id,
                'period_type' => 'weekly',
                'period_start' => $weekStart,
            ],
            [
                'period_date' => $weekStart,
                'period_end' => $weekEnd,
                'sales_amount' => $sourceSnapshot['sales_amount'],
                'delivery_fee_amount' => $sourceSnapshot['delivery_fee_amount'],
                'amount_due' => $sourceSnapshot['amount_due'],
                'total_online_share' => $sourceSnapshot['total_online_share'],
                'total_delivery_cost' => $sourceSnapshot['total_delivery_cost'],
                'total_refund' => $sourceSnapshot['total_refund'],
                'total_offline_sales' => $sourceSnapshot['total_offline_sales'],
                'net_amount' => $sourceSnapshot['net_amount'],
                'direction' => $sourceSnapshot['direction'],
                'due_date' => Carbon::parse($weekEnd)->addDays(7)->toDateString(),
                'notes' => "Settlement minggu {$weekStart} – {$weekEnd} untuk {$outlet->name}",
            ],
        );

        $wasRecentlyCreated = $settlement->wasRecentlyCreated;
        $settlement = Settlement::query()->lockForUpdate()->findOrFail($settlement->id);
        $settlement->adjustment_amount = $adjustmentTotal;
        $settlement->recalculateStatus();

        if ($wasRecentlyCreated) {
            $this->notificationService->notifySettlementGenerated($settlement);
        }

        return $settlement;
    }

    /**
     * Backfill weekly settlements for a date range.
     * Scans completed orders and groups them by outlet and ISO week.
     */
    public function backfill(CarbonInterface $from, CarbonInterface $to): int
    {
        $outlets = Outlet::where('status', 'active')->get();
        $count = 0;

        foreach ($outlets as $outlet) {
            $orders = Order::where('outlet_id', $outlet->id)
                ->where('status', 'completed')
                ->whereRaw('COALESCE(completed_at, created_at) >= ?', [$from->toDateString()])
                ->whereRaw('COALESCE(completed_at, created_at) <= ?', [$to->toDateString().' 23:59:59'])
                ->get();

            $orderWeeks = $orders
                ->map(fn ($o) => ($o->completed_at ?? $o->created_at)->startOfWeek(Carbon::MONDAY)->toDateString())
                ->unique();

            $offlineWeeks = OfflineSale::where('outlet_id', $outlet->id)
                ->whereFromDay('created_at', $from)
                ->whereUntilDay('created_at', $to)
                ->get()
                ->map(fn ($s) => $s->created_at->startOfWeek(Carbon::MONDAY)->toDateString())
                ->unique();

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
        DB::transaction(function () use ($outlet, $date): void {
            Outlet::lockForSettlement($outlet->id);
            $this->generateForOutletLocked($outlet, $date);
        });
    }

    /**
     * Sync outlet_payables adjustments (exchanges only) to settlement.adjustment_amount.
     * Return of unsold stock (consignment) must NOT affect settlement.
     * Single source of truth — called from ExchangeService and ReturnService (cleanup).
     */
    public function syncAdjustments(Outlet $outlet, CarbonInterface $date): void
    {
        DB::transaction(function () use ($outlet, $date): void {
            Outlet::lockForSettlement($outlet->id);
            $this->syncAdjustmentsLocked($outlet, $date);
        });
    }

    private function syncAdjustmentsLocked(Outlet $outlet, CarbonInterface $date): void
    {
        $weekStart = Carbon::parse($date)->startOfWeek(Carbon::MONDAY)->toDateString();
        $weekEnd = Carbon::parse($date)->endOfWeek(Carbon::SUNDAY)->toDateString();
        $adjustmentTotal = $this->adjustmentTotalForWeek($outlet, $weekStart, $weekEnd);
        $settlement = Settlement::query()
            ->where('outlet_id', $outlet->id)
            ->where('period_type', 'weekly')
            ->whereDate('period_start', $weekStart)
            ->lockForUpdate()
            ->first();

        if (! $settlement) {
            return;
        }

        if ($this->hasFinancialActivity($settlement)) {
            $sourceSnapshot = $this->snapshotFromSettlement($settlement);
            $sourceSnapshot['adjustment_amount'] = $adjustmentTotal;
            $this->recordReconciliationIssue($settlement, $sourceSnapshot);

            return;
        }

        $settlement->update(['adjustment_amount' => $adjustmentTotal]);
        $settlement->recalculateStatus();
    }

    private function adjustmentTotalForWeek(Outlet $outlet, string $weekStart, string $weekEnd): float
    {
        return (float) OutletPayable::query()
            ->where('outlet_id', $outlet->id)
            ->where('type', 'adjustment')
            ->where('reference_type', ExchangeRequest::class)
            ->whereBetween('created_at', [$weekStart, $weekEnd.' 23:59:59'])
            ->sum('amount');
    }

    private function buildSourceSnapshot(
        Outlet $outlet,
        $orders,
        $offlineSales,
        float $adjustmentTotal,
        string $weekStart,
        string $weekEnd,
    ): array {
        $onlineOutletShare = $orders->sum(fn (Order $order) => $order->items->sum(function ($item): float {
            $selling = (float) ($item->selling_price_snapshot ?? 0);
            $center = (float) ($item->center_price_snapshot ?? 0);

            return ($selling - $center) * $item->quantity;
        }));
        $orderIds = $orders->pluck('id');
        $deliveryCostTotal = $orderIds->isNotEmpty()
            ? (float) Delivery::whereIn('order_id', $orderIds)->sum('courier_cost')
            : 0.0;
        $refundTotal = (float) Order::query()
            ->where('outlet_id', $outlet->id)
            ->whereIn('payment_status', ['refunded', 'refund_in_progress'])
            ->whereNotNull('refund_amount')
            ->where('refund_amount', '>', 0)
            ->whereFromDay('refund_requested_at', $weekStart)
            ->whereUntilDay('refund_requested_at', $weekEnd)
            ->sum('refund_amount');
        $offlineSalesTotal = $offlineSales->sum(fn (OfflineSale $sale) => (float) $sale->center_price * $sale->quantity);
        $netAmount = $onlineOutletShare - $deliveryCostTotal - $refundTotal - $offlineSalesTotal;

        return [
            'sales_amount' => $orders->sum(fn (Order $order) => (float) $order->total - (float) $order->delivery_fee) + $offlineSalesTotal,
            'delivery_fee_amount' => $orders->sum(fn (Order $order) => (float) $order->delivery_fee),
            'amount_due' => abs($netAmount),
            'total_online_share' => $onlineOutletShare,
            'total_delivery_cost' => $deliveryCostTotal,
            'total_refund' => $refundTotal,
            'total_offline_sales' => $offlineSalesTotal,
            'net_amount' => $netAmount,
            'direction' => $netAmount >= 0 ? Settlement::DIRECTION_OWNER_PAYS : Settlement::DIRECTION_OUTLET_PAYS,
            'adjustment_amount' => $adjustmentTotal,
        ];
    }

    private function zeroSourceSnapshot(float $adjustmentTotal): array
    {
        return [
            'sales_amount' => 0.0,
            'delivery_fee_amount' => 0.0,
            'amount_due' => 0.0,
            'total_online_share' => 0.0,
            'total_delivery_cost' => 0.0,
            'total_refund' => 0.0,
            'total_offline_sales' => 0.0,
            'net_amount' => 0.0,
            'direction' => Settlement::DIRECTION_OWNER_PAYS,
            'adjustment_amount' => $adjustmentTotal,
        ];
    }

    private function hasFinancialActivity(Settlement $settlement): bool
    {
        return (float) $settlement->paid_amount !== 0.0
            || (float) $settlement->adjustment_amount !== 0.0
            || (float) $settlement->overpaid_amount !== 0.0
            || SettlementPayment::query()->where('settlement_id', $settlement->id)->exists()
            || SettlementPaymentAllocation::query()->where('settlement_id', $settlement->id)->exists();
    }

    private function snapshotFromSettlement(Settlement $settlement): array
    {
        return [
            'sales_amount' => (float) $settlement->sales_amount,
            'delivery_fee_amount' => (float) $settlement->delivery_fee_amount,
            'amount_due' => (float) $settlement->amount_due,
            'total_online_share' => (float) $settlement->total_online_share,
            'total_delivery_cost' => (float) $settlement->total_delivery_cost,
            'total_refund' => (float) $settlement->total_refund,
            'total_offline_sales' => (float) $settlement->total_offline_sales,
            'net_amount' => (float) $settlement->net_amount,
            'direction' => $settlement->direction,
            'adjustment_amount' => (float) $settlement->adjustment_amount,
        ];
    }

    private function resolveReconciliationIssue(Settlement $settlement): void
    {
        SettlementReconciliationIssue::query()
            ->where('settlement_id', $settlement->id)
            ->where('status', 'open')
            ->update(['status' => 'resolved']);
    }

    private function recordReconciliationIssue(Settlement $settlement, array $sourceSnapshot): void
    {
        $settlementSnapshot = $this->snapshotFromSettlement($settlement);
        $normalizedSource = array_map(
            static fn ($value) => is_numeric($value) ? (float) $value : $value,
            $sourceSnapshot,
        );

        if ($settlementSnapshot === $normalizedSource) {
            $this->resolveReconciliationIssue($settlement);

            return;
        }

        $issue = SettlementReconciliationIssue::query()
            ->where('settlement_id', $settlement->id)
            ->where('status', 'open')
            ->lockForUpdate()
            ->first();

        if ($issue) {
            $issue->update([
                'settlement_snapshot' => $settlementSnapshot,
                'source_snapshot' => $normalizedSource,
                'detected_at' => now(),
            ]);

            return;
        }

        SettlementReconciliationIssue::create([
            'settlement_id' => $settlement->id,
            'status' => 'open',
            'settlement_snapshot' => $settlementSnapshot,
            'source_snapshot' => $normalizedSource,
            'detected_at' => now(),
        ]);
    }
}
