<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OutletInventory;
use App\Models\RestockRequest;
use App\Services\DeliveryIntelligenceService;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(DeliveryIntelligenceService $intelligence): Response
    {
        $outlet = auth()->user()->outlet;
        abort_unless($outlet, 403);

        $outletDeliveries = Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id));

        return Inertia::render('outlet/dashboard', [
            'outlet' => $outlet,
            'stats' => [
                'pendingOrders' => Order::where('outlet_id', $outlet->id)->where('status', 'pending_confirmation')->count(),
                'preparingOrders' => Order::where('outlet_id', $outlet->id)->where('status', 'preparing')->count(),
                'readyForPickupOrders' => Order::where('outlet_id', $outlet->id)->where('status', 'ready_for_pickup')->count(),
                'todayOrders' => Order::where('outlet_id', $outlet->id)->whereDate('created_at', today())->count(),
                'lowStocks' => OutletInventory::where('outlet_id', $outlet->id)
                    ->whereRaw('(current_stock - reserved_stock) <= minimum_stock')
                    ->count(),
                'pendingRestocks' => RestockRequest::where('outlet_id', $outlet->id)
                    ->whereIn('status', ['requested', 'preparing', 'shipped'])
                    ->count(),
            ],
            'lowStockItems' => OutletInventory::with('product:id,name,unit')
                ->where('outlet_id', $outlet->id)
                ->whereRaw('(current_stock - reserved_stock) <= minimum_stock')
                ->get(['id', 'product_id', 'current_stock', 'reserved_stock', 'minimum_stock']),
            'deliveryStats' => [
                'needsDispatch' => Order::where('outlet_id', $outlet->id)->where('status', 'ready_for_pickup')->whereDoesntHave('delivery')->count(),
                'waitingPickup' => (clone $outletDeliveries)->where('status', 'waiting_pickup')->count(),
                'inTransit' => (clone $outletDeliveries)->whereIn('status', ['picked_up', 'delivering'])->count(),
                'failed' => (clone $outletDeliveries)->where('status', 'failed')->count(),
                'completedToday' => (clone $outletDeliveries)->where('status', 'completed')->whereDate('updated_at', today())->count(),
                'avgDispatchTime' => $this->avgDispatchTime($outlet->id),
            ],
            'failureReasons' => (clone $outletDeliveries)
                ->where('status', 'failed')
                ->whereNotNull('failed_reason')
                ->select('failed_reason', \Illuminate\Support\Facades\DB::raw('COUNT(*) as count'))
                ->groupBy('failed_reason')
                ->orderByDesc('count')
                ->limit(3)
                ->get()
                ->map(fn ($item) => ['reason' => $item->failed_reason, 'count' => $item->count]),
            'recentOrders' => Order::where('outlet_id', $outlet->id)
                ->whereIn('status', ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup'])
                ->latest()
                ->limit(5)
                ->get(['id', 'order_code', 'status', 'customer_name', 'total', 'created_at']),
        ]);
    }

    private function avgDispatchTime(int $outletId): ?int
    {
        $orders = Order::where('outlet_id', $outletId)
            ->whereHas('delivery')
            ->whereDate('updated_at', today())
            ->with('delivery')
            ->get();

        if ($orders->isEmpty()) {
            return null;
        }

        $times = $orders->map(function (Order $o): ?int {
            if (!$o->delivery || !$o->delivery->assigned_at) {
                return null;
            }

            return (int) $o->updated_at->diffInMinutes($o->delivery->assigned_at);
        })->filter();

        return $times->isNotEmpty() ? (int) round($times->avg()) : null;
    }
}
