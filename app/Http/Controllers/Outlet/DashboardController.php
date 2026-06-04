<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OutletInventory;
use App\Models\RestockRequest;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $outlet = auth()->user()->outlet;
        abort_unless($outlet, 403);

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
                'waitingPickup' => Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))->where('status', 'waiting_pickup')->count(),
                'inTransit' => Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))->whereIn('status', ['picked_up', 'delivering'])->count(),
                'failed' => Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))->where('status', 'failed')->count(),
            ],
            'recentOrders' => Order::where('outlet_id', $outlet->id)
                ->whereIn('status', ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup'])
                ->latest()
                ->limit(5)
                ->get(['id', 'order_code', 'status', 'customer_name', 'total', 'created_at']),
        ]);
    }
}
