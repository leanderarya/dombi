<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
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
                'lowStocks' => OutletInventory::whereRaw('(current_stock - reserved_stock) <= minimum_stock')->count(),
                'pendingOrders' => Order::where('status', 'pending')->count(),
                'preparingOrders' => Order::where('status', 'preparing')->count(),
                'readyForPickupOrders' => Order::where('status', 'ready_for_pickup')->count(),
            ],
        ]);
    }
}
