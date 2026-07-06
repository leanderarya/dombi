<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $orders = Order::query()
            ->with(['outlet', 'items', 'delivery.courier', 'statusHistories'])
            ->when(true, function ($query) use ($request) {
                $status = $request->string('status', 'needs_action')->toString();
                $compoundMap = [
                    'needs_action' => ['pending_confirmation', 'ready_for_pickup'],
                    'active' => ['confirmed', 'preparing', 'delivering'],
                    'cancelled' => ['cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'expired'],
                    'failed' => ['failed_delivery'],
                ];
                if (isset($compoundMap[$status])) {
                    $query->whereIn('status', $compoundMap[$status]);
                } elseif ($status !== '') {
                    $query->where('status', $status);
                }
            })
            ->when($request->filled('outlet_id'), fn ($query) => $query->where('outlet_id', $request->integer('outlet_id')))
            ->when($request->filled('date'), fn ($query) => $query->whereDate('created_at', $request->date('date')))
            ->when($request->filled('search'), fn ($query) => $query->where('order_code', 'like', '%'.$request->string('search')->toString().'%'))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        // Don't cache Eloquent models — serialization issues. Cache scalars only.
        $outlets = Outlet::orderBy('name')->get(['id', 'name']);
        $couriers = User::where('role', 'courier')->where('is_active', true)->orderBy('name')->get(['id', 'name']);

        // Cache stats for 10 seconds (scalar values only)
        $stats = Cache::remember('owner:order_stats', 10, function () {
            return [
                'pendingOrders' => Order::where('status', 'pending_confirmation')->count(),
                'activeDeliveries' => Order::whereIn('status', ['picked_up', 'delivering'])->count(),
                'failedDeliveries' => Order::where('status', 'failed_delivery')->count(),
            ];
        });

        return Inertia::render('owner/orders/index', [
            'orders' => $orders,
            'outlets' => $outlets,
            'filters' => $request->only(['status', 'outlet_id', 'date', 'search']),
            'stats' => $stats,
            'couriers' => $couriers,
        ]);
    }

    public function show(Order $order): Response
    {
        $order->load(['customer', 'outlet', 'items.product', 'statusHistories.actor', 'delivery.courier']);

        $reservedStocks = OutletInventory::query()
            ->with('product')
            ->where('outlet_id', $order->outlet_id)
            ->whereIn('product_id', $order->items->pluck('product_id'))
            ->get();

        return Inertia::render('owner/orders/show', [
            'order' => $order,
            'reservedStocks' => $reservedStocks,
            'couriers' => User::where('role', 'courier')->where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
