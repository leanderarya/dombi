<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CancelOrderRequest;
use App\Http\Requests\Customer\StoreOrderRequest;
use App\Models\Order;
use App\Services\OrderService;
use App\Services\OrderStatusService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('customer/orders/index', [
            'activeOrders' => collect(),
            'historyOrders' => [],
        ]);
    }

    public function store(StoreOrderRequest $request, OrderService $orderService): RedirectResponse
    {
        $order = $orderService->createCheckoutOrder(null, $request->validated());

        return redirect()->route('track', ['token' => $order->recovery_token])->with('success', 'Order berhasil dibuat.');
    }

    public function show(Order $order): Response
    {
        $user = auth()->user();

        if ($user->customer?->id !== $order->customer_id) {
            abort(403, 'Anda tidak memiliki akses ke pesanan ini.');
        }

        return Inertia::render('customer/orders/show', [
            'order' => $order->load(['outlet', 'items.product', 'statusHistories.actor', 'delivery.courier']),
            'cancellationReasons' => OrderStatusService::cancellationReasons(),
        ]);
    }

    public function cancel(CancelOrderRequest $request, Order $order, OrderStatusService $orderStatusService): RedirectResponse
    {
        $validated = $request->validated();
        $orderStatusService->cancelByCustomer($order, $validated['reason'], $validated['note'] ?? null);

        return redirect()->route('track', ['token' => $order->recovery_token])->with('success', 'Pesanan berhasil dibatalkan.');
    }

    public function repeat(Order $order, OrderService $orderService): RedirectResponse
    {
        $user = auth()->user();

        if ($user->customer?->id !== $order->customer_id) {
            abort(403, 'Anda tidak memiliki akses ke pesanan ini.');
        }

        $newOrder = $orderService->repeatOrder($order->customer, $order->load('items'));

        return redirect()->route('track', ['token' => $newOrder->recovery_token])->with('success', 'Order ulang berhasil dibuat.');
    }
}
