<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $orders = Order::query()
            ->with(['outlet', 'customer'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
            ->when($request->filled('outlet_id'), fn ($query) => $query->where('outlet_id', $request->integer('outlet_id')))
            ->when($request->filled('date'), fn ($query) => $query->whereDate('created_at', $request->date('date')))
            ->when($request->filled('search'), fn ($query) => $query->where('order_code', 'like', '%'.$request->string('search')->toString().'%'))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('owner/orders/index', [
            'orders' => $orders,
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['status', 'outlet_id', 'date', 'search']),
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
