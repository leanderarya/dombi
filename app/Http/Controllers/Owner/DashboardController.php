<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\RestockRequest;
use App\Models\StockMovement;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('owner/dashboard', [
            'stats' => [
                'activeOutlets' => Outlet::where('status', 'active')->count(),
                'activeProducts' => Product::where('is_active', true)->count(),
                'todayOrders' => Order::whereDate('created_at', today())->count(),
                'activeOrders' => Order::whereIn('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'])->count(),
                'pendingOrders' => Order::where('status', 'pending')->count(),
                'readyPickupOrders' => Order::where('status', 'ready_for_pickup')->count(),
                'activeDeliveries' => Delivery::whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])->count(),
                'failedDeliveries' => Delivery::where('status', 'failed')->count(),
                'lowStocks' => OutletInventory::whereRaw('(current_stock - reserved_stock) <= minimum_stock')->count(),
                'pendingRestocks' => RestockRequest::where('status', 'requested')->count(),
            ],
            'alerts' => [
                'failedDeliveries' => Delivery::where('status', 'failed')
                    ->with(['order:id,order_code,customer_name', 'courier:id,name'])
                    ->latest()
                    ->limit(5)
                    ->get(['id', 'order_id', 'courier_id', 'status', 'failed_reason', 'updated_at']),
                'lowStockItems' => OutletInventory::with(['outlet:id,name', 'product:id,name'])
                    ->whereRaw('(current_stock - reserved_stock) <= minimum_stock')
                    ->limit(8)
                    ->get(['id', 'outlet_id', 'product_id', 'current_stock', 'reserved_stock', 'minimum_stock']),
                'pendingRestocks' => RestockRequest::where('status', 'requested')
                    ->with('outlet:id,name')
                    ->latest()
                    ->limit(5)
                    ->get(['id', 'outlet_id', 'status', 'created_at']),
            ],
            'recentActivity' => StockMovement::with(['outlet:id,name', 'product:id,name', 'creator:id,name'])
                ->latest()
                ->limit(10)
                ->get(['id', 'outlet_id', 'product_id', 'type', 'quantity', 'before_stock', 'after_stock', 'created_by', 'created_at']),
        ]);
    }
}
