<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\RestockRequest;
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
                'lowStocks' => OutletInventory::whereRaw('(current_stock - reserved_stock) <= minimum_stock')->count(),
                'pendingRestocks' => RestockRequest::where('status', 'requested')->count(),
                'activeDeliveries' => Delivery::whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])->count(),
                'pendingOrders' => Order::where('status', 'pending')->count(),
                'preparingOrders' => Order::where('status', 'preparing')->count(),
                'readyForPickupOrders' => Order::where('status', 'ready_for_pickup')->count(),
            ],
        ]);
    }
}
