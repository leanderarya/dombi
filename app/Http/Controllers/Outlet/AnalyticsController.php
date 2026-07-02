<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AnalyticsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $user->outlet;
        abort_unless($outlet, 403);

        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $totalRevenue = Order::where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$from, $to])
            ->sum('total');

        $totalOrders = Order::where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$from, $to])
            ->count();

        $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

        $topProducts = OrderItem::whereHas('order', function ($query) use ($outlet, $from, $to) {
            $query->where('outlet_id', $outlet->id)
                ->where('status', 'completed')
                ->whereBetween('completed_at', [$from, $to]);
        })
            ->select('product_name', DB::raw('SUM(quantity) as total_qty'), DB::raw('SUM(subtotal) as total_revenue'))
            ->groupBy('product_name')
            ->orderByDesc('total_revenue')
            ->limit(5)
            ->get();

        $dailyRevenue = Order::where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$from, $to])
            ->select(DB::raw('DATE(completed_at) as date'), DB::raw('SUM(total) as revenue'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return Inertia::render('outlet/analytics/index', [
            'outlet' => $outlet->only(['id', 'name']),
            'kpis' => [
                'total_revenue' => (float) $totalRevenue,
                'total_orders' => (int) $totalOrders,
                'avg_order_value' => (float) $avgOrderValue,
            ],
            'topProducts' => $topProducts,
            'dailyRevenue' => $dailyRevenue,
            'period' => $period,
            'dateFrom' => $from->toDateString(),
            'dateTo' => $to->toDateString(),
        ]);
    }

    private function resolvePeriod(string $period, Request $request): array
    {
        return match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            'custom' => $this->resolveCustomRange($request),
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }

    private function resolveCustomRange(Request $request): array
    {
        $from = $request->date('date_from') ?? now()->startOfDay();
        $to = $request->date('date_to') ?? $from->copy()->endOfDay();

        return [$from->startOfDay(), $to->endOfDay()];
    }
}
