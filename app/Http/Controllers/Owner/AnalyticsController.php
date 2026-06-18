<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AnalyticsController extends Controller
{
    public function index(Request $request): Response
    {
        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $totalRevenue = Order::where('status', Order::STATUS_COMPLETED)
            ->whereBetween('created_at', [$from, $to])
            ->sum('total');

        $totalOrders = Order::where('status', Order::STATUS_COMPLETED)
            ->whereBetween('created_at', [$from, $to])
            ->count();

        $activeOutlets = Outlet::query()->active()->count();

        $outletRevenue = Order::where('status', Order::STATUS_COMPLETED)
            ->whereBetween('created_at', [$from, $to])
            ->select('outlet_id', DB::raw('SUM(total) as revenue'), DB::raw('COUNT(*) as orders'))
            ->groupBy('outlet_id')
            ->with('outlet:id,name')
            ->orderByDesc('revenue')
            ->get();

        $topProducts = OrderItem::whereHas('order', function ($query) use ($from, $to) {
            $query->where('status', Order::STATUS_COMPLETED)
                ->whereBetween('created_at', [$from, $to]);
        })
            ->select('product_name', DB::raw('SUM(quantity) as total_qty'), DB::raw('SUM(subtotal) as total_revenue'))
            ->groupBy('product_name')
            ->orderByDesc('total_revenue')
            ->limit(10)
            ->get();

        return Inertia::render('owner/analytics/index', [
            'kpis' => [
                'total_revenue' => (float) $totalRevenue,
                'total_orders' => (int) $totalOrders,
                'active_outlets' => (int) $activeOutlets,
            ],
            'outletRevenue' => $outletRevenue,
            'topProducts' => $topProducts,
            'period' => $period,
        ]);
    }

    private function resolvePeriod(string $period, Request $request): array
    {
        return match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }
}
