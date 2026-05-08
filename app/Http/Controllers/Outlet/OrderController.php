<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignCourierRequest;
use App\Http\Requests\Outlet\UpdateOrderStatusRequest;
use App\Models\Order;
use App\Models\User;
use App\Services\DeliveryService;
use App\Services\OrderStatusService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $orders = Order::query()
            ->where('outlet_id', $outlet->id)
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('outlet/orders/index', [
            'outlet' => $outlet,
            'orders' => $orders,
            'filters' => $request->only(['status']),
        ]);
    }

    public function show(Request $request, Order $order): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $order->outlet_id === $outlet->id, 403);

        return Inertia::render('outlet/orders/show', [
            'order' => $order->load(['items.product', 'statusHistories.actor', 'delivery.courier']),
            'couriers' => User::where('role', 'courier')->where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function updateStatus(UpdateOrderStatusRequest $request, Order $order, OrderStatusService $orderStatusService): RedirectResponse
    {
        $orderStatusService->updateStatus($order, $request->validated('status'), $request->user());

        return redirect()->route('outlet.orders.show', $order)->with('success', 'Status order berhasil diperbarui.');
    }

    public function assignCourier(AssignCourierRequest $request, Order $order, DeliveryService $deliveryService): RedirectResponse
    {
        $courier = User::findOrFail($request->integer('courier_id'));
        $deliveryService->assignCourier($order, $courier, $request->user());

        return redirect()->route('outlet.orders.show', $order)->with('success', 'Kurir berhasil di-assign.');
    }
}
