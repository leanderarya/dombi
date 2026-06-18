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

        if (! $user->isOwner() && $user->customer?->id !== $order->customer_id) {
            abort(403, 'Anda tidak memiliki akses ke pesanan ini.');
        }

        return Inertia::render('customer/orders/show', [
            'order' => $order->load(['outlet', 'items.product', 'items.variant.family', 'statusHistories.actor', 'delivery.courier']),
            'cancellationReasons' => OrderStatusService::cancellationReasons(),
        ]);
    }

    public function cancel(CancelOrderRequest $request, Order $order, OrderStatusService $orderStatusService): RedirectResponse
    {
        $user = $request->user();
        if ($user->role === 'customer' && $order->customer_id !== $user->customer?->id) {
            abort(403);
        }

        $validated = $request->validated();
        $orderStatusService->cancelByCustomer($order, $validated['reason'], $validated['note'] ?? null);

        return redirect()->route('track', ['token' => $order->recovery_token])->with('success', 'Pesanan berhasil dibatalkan.');
    }

    public function repeat(Order $order, OrderService $orderService): RedirectResponse
    {
        $this->authorizeReorder($order);

        return $this->restoreCartAndRedirect($order, $orderService);
    }

    public function restoreCart(Order $order, OrderService $orderService): RedirectResponse
    {
        $this->authorizeReorder($order);

        return $this->restoreCartAndRedirect($order, $orderService);
    }

    private function authorizeReorder(Order $order): void
    {
        $user = auth()->user();

        // Owner can reorder any order
        if ($user && $user->isOwner()) {
            return;
        }

        // Authenticated customer — check ownership
        if ($user && $user->customer?->id === $order->customer_id) {
            return;
        }

        // Recovered guest — check session recovery data
        $recovery = session('guest_recovery');
        if (
            is_array($recovery)
            && ($recovery['customer_id'] ?? null) === $order->customer_id
            && in_array($order->id, $recovery['order_ids'] ?? [], true)
        ) {
            return;
        }

        abort(403, 'Anda tidak memiliki akses ke pesanan ini.');
    }

    private function restoreCartAndRedirect(Order $order, OrderService $orderService): RedirectResponse
    {
        $result = $orderService->restoreCartFromOrder($order->load('items'));

        if (empty($result['items'])) {
            $errorRedirect = auth()->check()
                ? redirect()->route('customer.orders.show', $order)
                : redirect()->route('track', ['token' => $order->recovery_token]);

            return $errorRedirect->with('error', 'Produk dari pesanan ini sudah tidak tersedia.');
        }

        // Store restored items in session cart for checkout
        session()->put('checkout.cart', $result['items']);

        // Build flash message
        $itemCount = count($result['items']);
        $message = $itemCount === 1
            ? '1 produk berhasil dipulihkan ke keranjang.'
            : "{$itemCount} produk berhasil dipulihkan ke keranjang.";

        if (! empty($result['warnings'])) {
            $message .= ' '.implode(' ', $result['warnings']);
        }

        return redirect()->route('customer.checkout.index')
            ->with('success', $message);
    }
}
