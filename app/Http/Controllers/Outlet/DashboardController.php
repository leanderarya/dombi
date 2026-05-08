<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OutletInventory;
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
                'pendingOrders' => Order::where('outlet_id', $outlet->id)->where('status', 'pending')->count(),
                'preparingOrders' => Order::where('outlet_id', $outlet->id)->where('status', 'preparing')->count(),
                'readyForPickupOrders' => Order::where('outlet_id', $outlet->id)->where('status', 'ready_for_pickup')->count(),
                'todayOrders' => Order::where('outlet_id', $outlet->id)->whereDate('created_at', today())->count(),
                'lowStocks' => OutletInventory::where('outlet_id', $outlet->id)
                    ->whereRaw('(current_stock - reserved_stock) <= minimum_stock')
                    ->count(),
            ],
        ]);
    }
}
