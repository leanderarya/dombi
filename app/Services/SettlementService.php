<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\OutletPayable;
use App\Models\SettlementPeriod;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SettlementService
{
    /**
     * Record a sale payable when an order is completed.
     */
    public function recordSale(Order $order): void
    {
        if ($order->status !== 'completed') {
            return;
        }

        $centerShare = $order->items->sum(fn (OrderItem $item) => (float) $item->center_price_snapshot * $item->quantity);
        $outletMargin = $order->items->sum(fn (OrderItem $item) => (float) $item->outlet_margin_snapshot * $item->quantity);

        OutletPayable::create([
            'outlet_id' => $order->outlet_id,
            'order_id' => $order->id,
            'type' => 'sale',
            'amount' => (float) $order->total,
            'center_share' => $centerShare,
            'outlet_margin' => $outletMargin,
            'notes' => "Penjualan order {$order->order_code}",
        ]);
    }

    /**
     * Get settlement summary for an outlet within a date range.
     */
    public function getOutletSummary(int $outletId, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $from = $from ?? now()->startOfDay();
        $to = $to ?? now()->endOfDay();

        $payables = OutletPayable::query()
            ->where('outlet_id', $outletId)
            ->whereBetween('created_at', [$from, $to])
            ->get();

        $sales = $payables->where('type', 'sale');
        $settlements = $payables->where('type', 'settlement');

        $grossRevenue = $sales->sum('amount');
        $centerShare = $sales->sum('center_share');
        $outletMargin = $sales->sum('outlet_margin');
        $settledAmount = $settlements->sum('amount');

        // Get units sold from order items
        $orderIds = $sales->pluck('order_id')->filter();
        $unitsSold = OrderItem::whereIn('order_id', $orderIds)->sum('quantity');

        // Top products
        $topProducts = OrderItem::query()
            ->whereIn('order_id', $orderIds)
            ->select('product_name', DB::raw('SUM(quantity) as total_qty'), DB::raw('SUM(subtotal) as total_revenue'))
            ->groupBy('product_name')
            ->orderByDesc('total_revenue')
            ->limit(5)
            ->get();

        return [
            'gross_revenue' => (float) $grossRevenue,
            'center_share' => (float) $centerShare,
            'outlet_margin' => (float) $outletMargin,
            'settled_amount' => (float) $settledAmount,
            'outstanding_amount' => (float) $centerShare - $settledAmount,
            'units_sold' => (int) $unitsSold,
            'orders_count' => $sales->count(),
            'top_products' => $topProducts,
        ];
    }

    /**
     * Get owner dashboard settlement data across all outlets.
     */
    public function getOwnerDashboard(?Carbon $from = null, ?Carbon $to = null): array
    {
        $from = $from ?? now()->startOfMonth();
        $to = $to ?? now()->endOfDay();

        $outlets = Outlet::where('status', 'active')->get();
        $outletSummaries = [];

        foreach ($outlets as $outlet) {
            $summary = $this->getOutletSummary($outlet->id, $from, $to);
            $outletSummaries[] = [
                'outlet' => [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                ],
                ...$summary,
            ];
        }

        // Sort by gross revenue descending
        usort($outletSummaries, fn ($a, $b) => $b['gross_revenue'] <=> $a['gross_revenue']);

        $totalGrossRevenue = array_sum(array_column($outletSummaries, 'gross_revenue'));
        $totalCenterShare = array_sum(array_column($outletSummaries, 'center_share'));
        $totalOutletMargin = array_sum(array_column($outletSummaries, 'outlet_margin'));
        $totalOutstanding = array_sum(array_column($outletSummaries, 'outstanding_amount'));

        return [
            'outlets' => $outletSummaries,
            'totals' => [
                'gross_revenue' => $totalGrossRevenue,
                'center_share' => $totalCenterShare,
                'outlet_margin' => $totalOutletMargin,
                'outstanding_amount' => $totalOutstanding,
                'outlets_count' => count($outletSummaries),
            ],
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
        ];
    }

    /**
     * Get the outstanding payable for an outlet.
     */
    public function getOutstandingPayable(int $outletId): float
    {
        $sales = OutletPayable::where('outlet_id', $outletId)
            ->where('type', 'sale')
            ->sum('center_share');

        $settlements = OutletPayable::where('outlet_id', $outletId)
            ->where('type', 'settlement')
            ->sum('amount');

        $adjustments = OutletPayable::where('outlet_id', $outletId)
            ->where('type', 'adjustment')
            ->sum('amount');

        return (float) $sales - (float) $settlements + (float) $adjustments;
    }

    /**
     * Record a settlement payment from outlet to center.
     */
    public function recordSettlement(int $outletId, float $amount, ?string $notes = null, ?int $createdBy = null): OutletPayable
    {
        return OutletPayable::create([
            'outlet_id' => $outletId,
            'type' => 'settlement',
            'amount' => -$amount, // Negative because it reduces payable
            'center_share' => 0,
            'outlet_margin' => 0,
            'notes' => $notes ?? 'Settlement payment',
            'created_by' => $createdBy,
        ]);
    }

    /**
     * Recalculate settlement period aggregates.
     */
    public function recalculatePeriod(int $outletId, string $periodType, Carbon $periodStart): SettlementPeriod
    {
        $periodEnd = match ($periodType) {
            'daily' => $periodStart->copy()->endOfDay(),
            'weekly' => $periodStart->copy()->endOfWeek(),
            'monthly' => $periodStart->copy()->endOfMonth(),
            default => $periodStart->copy()->endOfDay(),
        };

        $payables = OutletPayable::query()
            ->where('outlet_id', $outletId)
            ->where('type', 'sale')
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->get();

        $orderIds = $payables->pluck('order_id')->filter();
        $unitsSold = OrderItem::whereIn('order_id', $orderIds)->sum('quantity');

        $grossRevenue = $payables->sum('amount');
        $centerShare = $payables->sum('center_share');
        $outletMargin = $payables->sum('outlet_margin');

        $settledAmount = OutletPayable::query()
            ->where('outlet_id', $outletId)
            ->where('type', 'settlement')
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->sum('amount');

        return SettlementPeriod::updateOrCreate(
            [
                'outlet_id' => $outletId,
                'period_type' => $periodType,
                'period_start' => $periodStart->toDateString(),
            ],
            [
                'period_end' => $periodEnd->toDateString(),
                'orders_count' => $payables->count(),
                'units_sold' => $unitsSold,
                'gross_revenue' => $grossRevenue,
                'center_share' => $centerShare,
                'outlet_margin' => $outletMargin,
                'settled_amount' => abs((float) $settledAmount),
                'outstanding_amount' => (float) $centerShare - abs((float) $settledAmount),
                'calculated_at' => now(),
            ]
        );
    }
}
