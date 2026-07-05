<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CancelOrderRequest;
use App\Http\Requests\Customer\StoreOrderRequest;
use App\Models\Order;
use App\Services\MidtransService;
use App\Services\OrderService;
use App\Services\OrderStatusService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $customer = $user?->customer;

        $activeOrders = collect();
        $historyOrders = [];

        if ($customer) {
            $activeOrders = $customer->orders()
                ->whereIn('status', Order::ACTIVE_STATUSES)
                ->with(['outlet', 'items'])
                ->orderByDesc('ordered_at')
                ->get();

            $historyOrders = $customer->orders()
                ->whereIn('status', Order::HISTORY_STATUSES)
                ->with(['outlet', 'items'])
                ->orderByDesc('ordered_at')
                ->paginate(10)
                ->withQueryString();
        }

        return Inertia::render('customer/orders/index', [
            'activeOrders' => $activeOrders,
            'historyOrders' => $historyOrders,
        ]);
    }

    public function store(StoreOrderRequest $request, OrderService $orderService): RedirectResponse
    {
        $order = $orderService->createCheckoutOrder($request->user(), $request->validated());

        return redirect()->route('track', ['token' => $order->recovery_token])->with('success', 'Order berhasil dibuat.');
    }

    public function show(Order $order): Response
    {
        $user = auth()->user();

        if (! $user->isOwner() && $user->getCustomerOrCreate()->id !== $order->customer_id) {
            abort(403, 'Anda tidak memiliki akses ke pesanan ini.');
        }

        $customer = $user->getCustomerOrCreate();
        $activeReport = \App\Models\OrderReport::where('order_id', $order->id)
            ->where('customer_id', $customer->id)
            ->active()
            ->first();
        $hasRecentReport = \App\Models\OrderReport::where('order_id', $order->id)
            ->where('customer_id', $customer->id)
            ->exists();

        return Inertia::render('customer/orders/show', [
            'order' => $order->load(['outlet', 'items.product', 'items.variant.family', 'statusHistories.actor', 'delivery.courier']),
            'cancellationReasons' => OrderStatusService::cancellationReasons(),
            'activeReport' => $activeReport,
            'hasRecentReport' => $hasRecentReport,
            'canReport' => $order->status === \App\Models\Order::STATUS_COMPLETED
                && (! $order->completed_at || $order->completed_at->gt(now()->subDays(7)))
                && ! $hasRecentReport,
        ]);
    }

    public function confirmation(Order $order, string $token): Response
    {
        // Verify the recovery token matches
        if ($order->recovery_token !== $token) {
            abort(403, 'Token tidak valid.');
        }

        return Inertia::render('customer/orders/show', [
            'order' => $order->load(['outlet', 'items.product', 'items.variant.family', 'statusHistories.actor', 'delivery.courier']),
            'cancellationReasons' => OrderStatusService::cancellationReasons(),
            'isConfirmation' => true,
        ]);
    }

    public function confirm(Request $request, string $orderCode): Response
    {
        $order = Order::where('order_code', $orderCode)->firstOrFail();

        // Verify the user owns this order
        $user = $request->user();
        if ($user && $order->customer_id && $order->customer_id !== $user->getCustomerOrCreate()->id) {
            abort(403);
        }

        return Inertia::render('customer/orders/confirm', [
            'order' => [
                'id' => $order->id,
                'order_code' => $order->order_code,
                'items' => $order->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'variant_name' => $item->variant_name,
                    'quantity' => $item->quantity,
                    'subtotal' => $item->subtotal,
                ]),
                'total' => $order->total,
                'fulfillment_type' => $order->fulfillment_type,
                'confirmation_expires_at' => $order->confirmation_expires_at?->toISOString(),
                'payment_method' => $order->payment_method,
                'payment_status' => $order->payment_status,
                'recovery_token' => $order->recovery_token,
                'outlet' => $order->outlet ? [
                    'name' => $order->outlet->name,
                ] : null,
            ],
            'isLoggedIn' => $request->user() !== null,
            'snapToken' => $request->session()->get('snap_token'),
        ]);
    }

    /**
     * Create Snap payment token for a confirmed order.
     * Accessible by: logged-in customer, recovered guest, OR fresh checkout guest (CSRF-protected).
     */
    public function pay(Order $order): \Illuminate\Http\JsonResponse
    {
        // Ownership verification — permissive for checkout flow
        $user = auth()->user();
        if ($user) {
            // Logged-in user — check ownership
            if (! $user->isOwner() && $user->getCustomerOrCreate()->id !== $order->customer_id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
        } elseif ($order->customer_id) {
            // Guest — verify via recovery session OR via recent order (within 30 min)
            $recovery = session('guest_recovery');
            $hasRecovery = is_array($recovery)
                && ($recovery['customer_id'] ?? null) === $order->customer_id
                && in_array($order->id, $recovery['order_ids'] ?? [], true);

            $isFreshOrder = $order->created_at && $order->created_at->gt(now()->subMinutes(30));

            if (! $hasRecovery && ! $isFreshOrder) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
        }

        // Guard: order must be pending or confirmed (not already terminal)
        $terminalStatuses = [
            Order::STATUS_COMPLETED,
            Order::STATUS_CANCELLED_BY_CUSTOMER,
            Order::STATUS_CANCELLED_BY_OUTLET,
            Order::STATUS_REJECTED_BY_OUTLET,
            Order::STATUS_FAILED_DELIVERY,
            Order::STATUS_EXPIRED,
        ];
        if (in_array($order->status, $terminalStatuses, true)) {
            return response()->json([
                'error' => 'Pesanan sudah tidak aktif.',
            ], 422);
        }

        // Guard: order must not already be paid
        if ($order->payment_status === 'paid') {
            return response()->json([
                'error' => 'Pesanan sudah dibayar.',
            ], 422);
        }

        // Only for non-COD orders
        if ($order->payment_method === 'cod') {
            return response()->json([
                'error' => 'COD tidak memerlukan pembayaran online.',
            ], 422);
        }

        try {
            $midtrans = app(MidtransService::class);

            // If already has a pending Snap token, return it
            $pendingTx = $order->paymentTransactions()
                ->where('status', 'pending')
                ->first();

            if ($pendingTx) {
                return response()->json([
                    'snap_token' => $pendingTx->raw_response?->snap_token ?? null,
                    'midtrans_order_id' => $pendingTx->midtrans_order_id,
                    'message' => 'Token pembayaran sudah tersedia.',
                ]);
            }

            $snapToken = $midtrans->createSnapToken($order);

            return response()->json([
                'snap_token' => $snapToken,
                'midtrans_order_id' => $order->midtrans_order_id,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to create Snap token', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Gagal membuat token pembayaran. Silakan coba lagi.',
            ], 500);
        }
    }

    /**
     * Payment status polling endpoint.
     * Returns current payment status and Snap token for recovery.
     */
    public function paymentStatus(Order $order): \Illuminate\Http\JsonResponse
    {
        // Ownership check — same as pay()
        $user = auth()->user();
        if ($user && ! $user->isOwner() && $user->getCustomerOrCreate()->id !== $order->customer_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // If still pending, try to sync from Midtrans (webhook fallback)
        if ($order->payment_status === 'pending' && $order->midtrans_order_id) {
            try {
                $midtrans = app(MidtransService::class);
                $midtrans->syncStatusFromMidtrans($order);
                $order->refresh();
            } catch (\Exception $e) {
                Log::warning('Payment status sync failed', [
                    'order_id' => $order->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Get existing Snap token for retry
        $snapToken = null;
        if ($order->payment_status === 'pending') {
            $pendingTx = $order->paymentTransactions()
                ->where('status', 'pending')
                ->first();
            $snapToken = $pendingTx?->raw_response?->snap_token ?? null;
        }

        return response()->json([
            'payment_status' => $order->payment_status,
            'snap_token' => $snapToken,
            'midtrans_order_id' => $order->midtrans_order_id,
            'paid_at' => $order->paid_at?->toISOString(),
        ]);
    }

    public function cancel(CancelOrderRequest $request, Order $order, OrderStatusService $orderStatusService): RedirectResponse
    {
        $user = $request->user();
        if ($user->role === 'customer' && $order->customer_id !== $user->getCustomerOrCreate()->id) {
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
        if ($user && $user->getCustomerOrCreate()->id === $order->customer_id) {
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
