<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Http\Requests\Outlet\UpdateOrderStatusRequest;
use App\Models\Order;
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
            'order' => $order->load(['items.product', 'statusHistories.actor']),
        ]);
    }

    public function updateStatus(UpdateOrderStatusRequest $request, Order $order, OrderStatusService $orderStatusService): RedirectResponse
    {
        $orderStatusService->updateStatus($order, $request->validated('status'), $request->user());

        return redirect()->route('outlet.orders.show', $order)->with('success', 'Status order berhasil diperbarui.');
    }
}
