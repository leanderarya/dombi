<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\StoreOrderRequest;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('customer/orders/index', [
            'orders' => Order::where('customer_id', auth()->id())->with('outlet')->latest()->paginate(12),
        ]);
    }

    public function store(StoreOrderRequest $request, OrderService $orderService): RedirectResponse
    {
        $order = $orderService->createCustomerOrder($request->user(), $request->validated());

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
