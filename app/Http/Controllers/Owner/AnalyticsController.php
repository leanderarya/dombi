<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReport;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AnalyticsController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = $request->string('tab', 'dashboard')->toString();

        return match ($tab) {
            'audit' => $this->auditTrail($request),
            'laporan' => $this->laporan($request),
            'masalah' => $this->masalah($request),
            default => $this->dashboard($request),
        };
    }

    private function dashboard(Request $request): Response
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

    private function auditTrail(Request $request): Response
    {
        $query = StockMovement::with(['outlet:id,name', 'product:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('outlet_id')) {
            $query->where('outlet_id', $request->input('outlet_id'));
        }
        if ($request->filled('product_id')) {
            $query->where('product_id', $request->input('product_id'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        $movements = $query->paginate(20)->withQueryString();

        return Inertia::render('owner/analytics/index', [
            'movements' => $movements,
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'products' => Product::orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['outlet_id', 'product_id', 'type']),
        ]);
    }

    private function laporan(Request $request): Response
    {
        $dateFrom = $request->date('date_from') ?? today()->subDays(7);
        $dateTo = $request->date('date_to') ?? today();
        $outletId = $request->integer('outlet_id') ?: null;

        $ordersQuery = Order::query()
            ->whereBetween('created_at', [$dateFrom->startOfDay(), $dateTo->endOfDay()])
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId));

        $deliveriesQuery = Delivery::query()
            ->whereBetween('created_at', [$dateFrom->startOfDay(), $dateTo->endOfDay()])
            ->when($outletId, fn ($q) => $q->whereHas('order', fn ($oq) => $oq->where('outlet_id', $outletId)));

        // Single query for order stats using conditional aggregation
        $orderStats = (clone $ordersQuery)
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue")
            ->selectRaw("SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed")
            ->selectRaw("SUM(CASE WHEN status IN ('cancelled_by_customer', 'cancelled_by_outlet') THEN 1 ELSE 0 END) as cancelled")
            ->first();

        $ordersByStatus = (clone $ordersQuery)
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->all();

        // Single query for delivery stats
        $deliveryStats = (clone $deliveriesQuery)
            ->selectRaw("SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed")
            ->selectRaw("SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed")
            ->first();

        $deliveriesByStatus = (clone $deliveriesQuery)
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->all();

        // Cache outlets list
        $outlets = Cache::remember('owner:outlets_list', 300, fn () => Outlet::orderBy('name')->get(['id', 'name']));

        return Inertia::render('owner/analytics/index', [
            'summary' => [
                'totalOrders' => (int) ($orderStats->total ?? 0),
                'totalRevenue' => (float) ($orderStats->revenue ?? 0),
                'completedOrders' => (int) ($orderStats->completed ?? 0),
                'cancelledOrders' => (int) ($orderStats->cancelled ?? 0),
                'completedDeliveries' => (int) ($deliveryStats->completed ?? 0),
                'failedDeliveries' => (int) ($deliveryStats->failed ?? 0),
            ],
            'ordersByStatus' => $ordersByStatus,
            'deliveriesByStatus' => $deliveriesByStatus,
            'outlets' => $outlets,
            'filters' => $request->only(['date_from', 'date_to', 'outlet_id']),
        ]);
    }

    private function masalah(Request $request): Response
    {
        $query = OrderReport::with(['order.outlet', 'customer', 'resolver'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $reports = $query->paginate(20)->withQueryString();

        return Inertia::render('owner/analytics/index', [
            'reports' => $reports,
            'filters' => $request->only(['status']),
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
