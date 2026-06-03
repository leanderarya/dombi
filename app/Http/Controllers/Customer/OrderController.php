<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\StoreOrderRequest;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(): Response
    {
        $customerId = auth()->id();

        return Inertia::render('customer/orders/index', [
            'activeOrders' => Order::where('customer_id', $customerId)
                ->whereIn('status', Order::ACTIVE_STATUSES)
                ->with(['outlet', 'items', 'delivery:id,order_id,status,courier_id', 'delivery.courier:id,name'])
                ->latest()
                ->get(),
            'historyOrders' => Order::where('customer_id', $customerId)
                ->whereIn('status', Order::HISTORY_STATUSES)
                ->with(['outlet', 'items'])
                ->latest()
                ->paginate(12),
        ]);
    }

    public function store(StoreOrderRequest $request, OrderService $orderService): RedirectResponse
    {
        $order = $orderService->createCheckoutOrder($request->user(), $request->validated());

        if (! $request->user()) {
            Auth::login($order->customer);
        }

        return redirect()->route('customer.orders.show', $order)->with('success', 'Order berhasil dibuat.');
    }

    public function show(Order $order): Response
    {
        abort_unless($order->customer_id === auth()->id(), 403);

        return Inertia::render('customer/orders/show', [
            'order' => $order->load(['outlet', 'items.product', 'statusHistories.actor', 'delivery.courier']),
        ]);
    }

    public function repeat(Order $order, OrderService $orderService): RedirectResponse
    {
        $newOrder = $orderService->repeatOrder(auth()->user(), $order->load('items'));

        return redirect()->route('customer.orders.show', $newOrder)->with('success', 'Order ulang berhasil dibuat.');
    }
}
