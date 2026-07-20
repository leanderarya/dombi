<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CancelOrderRequest;
use App\Http\Requests\Customer\StoreOrderRequest;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\PaymentTransaction;
use App\Services\DokuService;
use App\Services\OrderService;
use App\Services\OrderStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
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
                // Exclude orders that have been fully expired (status = expired),
                // but INCLUDE orders with failed/expired PAYMENT that are still
                // pending_confirmation — customer can retry payment within the window.
                ->where(function ($q) {
                    $q->whereNull('payment_status')
                        ->orWhere('payment_status', 'pending')
                        ->orWhere('payment_status', 'paid')
                        // Failed/expired payment but order still pending_confirmation
                        // and within confirmation window — customer can retry
                        ->orWhere(function ($q2) {
                            $q2->whereIn('payment_status', ['failed', 'expired'])
                                ->where('status', Order::STATUS_PENDING_CONFIRMATION);
                        });
                })
                ->where(function ($q) {
                    $q->where('status', '!=', Order::STATUS_PENDING_CONFIRMATION)
                        ->orWhereNull('confirmation_expires_at')
                        ->orWhere('confirmation_expires_at', '>', now());
                })
                ->with(['outlet', 'items.variant.family'])
                ->select(['id', 'order_code', 'status', 'payment_status', 'fulfillment_type', 'total', 'ordered_at', 'created_at', 'outlet_id', 'recovery_token', 'customer_address'])
                ->orderByDesc('ordered_at')
                ->get();

            $historyOrders = $customer->orders()
                ->whereIn('status', Order::HISTORY_STATUSES)
                ->with(['outlet', 'items'])
                ->select(['id', 'order_code', 'status', 'payment_status', 'fulfillment_type', 'total', 'ordered_at', 'created_at', 'outlet_id', 'recovery_token', 'customer_address'])
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
        $activeReport = OrderReport::where('order_id', $order->id)
            ->where('customer_id', $customer->id)
            ->active()
            ->first();
        $hasRecentReport = OrderReport::where('order_id', $order->id)
            ->where('customer_id', $customer->id)
            ->exists();

        return Inertia::render('customer/orders/show', [
            'order' => $order->load(['outlet', 'items.product', 'items.variant.family', 'statusHistories.actor', 'delivery.courier']),
            'cancellationReasons' => OrderStatusService::cancellationReasons(),
            'activeReport' => $activeReport,
            'hasRecentReport' => $hasRecentReport,
            'canReport' => $order->status === Order::STATUS_COMPLETED
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

        // Only allow confirmation for pending orders
        if ($order->status !== Order::STATUS_PENDING_CONFIRMATION) {
            return Inertia::render('customer/orders/confirm', [
                'order' => null,
                'isLoggedIn' => $request->user() !== null,
                'error' => 'Pesanan sudah tidak dapat dikonfirmasi.',
            ]);
        }

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
                    'variant_name' => $item->variant_name_snapshot,
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
            'cancellationReasons' => OrderStatusService::cancellationReasons(),
        ]);
    }

    /**
     * Create DOKU payment for a confirmed order and redirect to payment page.
     * Accessible by: logged-in customer, recovered guest, OR fresh checkout guest (CSRF-protected).
     */
    public function pay(Request $request, Order $order): RedirectResponse
    {
        $validated = $request->validate([
            'payment_method' => ['nullable', 'string', Rule::in(array_keys(config('doku.methods')))],
        ]);

        if (($validated['payment_method'] ?? null) && $order->payment_method !== $validated['payment_method']) {
            $order->update(['payment_method' => $validated['payment_method']]);
        }

        // Ownership verification — permissive for checkout flow
        $user = auth()->user();
        if ($user) {
            // Logged-in user — check ownership
            if (! $user->isOwner() && $user->getCustomerOrCreate()->id !== $order->customer_id) {
                abort(403, 'Unauthorized');
            }
        } elseif ($order->customer_id) {
            // Guest — verify via recovery session OR via recent order (within 30 min)
            $recovery = session('guest_recovery');
            $hasRecovery = is_array($recovery)
                && ($recovery['customer_id'] ?? null) === $order->customer_id
                && in_array($order->id, $recovery['order_ids'] ?? [], true);

            $isFreshOrder = $order->created_at && $order->created_at->gt(now()->subMinutes(30));

            if (! $hasRecovery && ! $isFreshOrder) {
                abort(403, 'Unauthorized');
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
            return back()->with('error', 'Pesanan sudah tidak aktif.');
        }

        // Guard: order must not already be paid
        if ($order->payment_status === 'paid') {
            return redirect()->route('customer.orders.confirm', [
                'orderCode' => $order->order_code,
            ]);
        }

        // Guard: max payment retry attempts
        $paymentAttempts = PaymentTransaction::where('order_id', $order->id)->count();
        $maxPaymentAttempts = config('order.max_payment_attempts', 3);

        if ($paymentAttempts >= $maxPaymentAttempts) {
            return back()->with('error', 'Batas maksimum percobaan pembayaran tercapai.');
        }

        // Guard: if payment failed/expired, reset so user can retry
        if (in_array($order->payment_status, ['failed', 'expired'], true)) {
            try {
                $doku = app(DokuService::class);
                $doku->syncStatusFromDoku($order);
                $order->refresh();

                // If paid after sync, redirect to confirm
                if ($order->payment_status === 'paid') {
                    return redirect()->route('customer.orders.confirm', [
                        'orderCode' => $order->order_code,
                    ]);
                }

                // Still failed — clean up old transaction, allow retry
                $order->paymentTransactions()->where('status', 'failed')->delete();
                $order->update(['payment_status' => null, 'doku_order_id' => null]);
                $order->refresh();
            } catch (\Exception $e) {
                Log::warning('Payment status sync failed', [
                    'order_id' => $order->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        try {
            $doku = app(DokuService::class);

            // Check for existing pending transaction
            $pendingTx = $order->paymentTransactions()
                ->where('status', 'pending')
                ->first();

            if ($pendingTx && $order->doku_order_id) {
                // Already has a pending payment — sync status
                $doku->syncStatusFromDoku($order);
                $order->refresh();

                if ($order->payment_status === 'paid') {
                    return redirect()->route('customer.orders.confirm', [
                        'orderCode' => $order->order_code,
                    ]);
                }
            }

            // Clean up old transactions before creating new one (prevents duplicate doku_order_id)
            $order->paymentTransactions()->delete();
            $order->update(['doku_order_id' => null, 'payment_status' => null]);

            $paymentUrl = $doku->createPayment($order);

            return redirect()->away($paymentUrl);
        } catch (\Exception $e) {
            Log::error('Failed to create DOKU payment', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'Gagal membuat pembayaran. Silakan coba lagi.',
                ], 422);
            }

            return back()->with('error', 'Gagal membuat pembayaran. Silakan coba lagi.');
        }
    }

    /**
     * Payment status polling endpoint.
     * Returns current payment status and DOKU order ID.
     */
    public function paymentStatus(Order $order): JsonResponse
    {
        // Ownership check — same as pay()
        $user = auth()->user();
        if ($user) {
            if (! $user->isOwner() && $user->getCustomerOrCreate()->id !== $order->customer_id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
        } elseif ($order->customer_id) {
            $recovery = session('guest_recovery');
            $hasRecovery = is_array($recovery)
                && ($recovery['customer_id'] ?? null) === $order->customer_id
                && in_array($order->id, $recovery['order_ids'] ?? [], true);

            $isFreshOrder = $order->created_at && $order->created_at->gt(now()->subMinutes(30));

            if (! $hasRecovery && ! $isFreshOrder) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
        }

        // Always sync from DOKU API to ensure accurate status
        // This handles cases where webhook hasn't arrived yet
        if ($order->doku_order_id) {
            try {
                $doku = app(DokuService::class);
                $doku->syncStatusFromDoku($order);
                $order->refresh();
            } catch (\Exception $e) {
                Log::warning('Payment status sync failed', [
                    'order_id' => $order->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return response()->json([
            'payment_status' => $order->payment_status,
            'doku_order_id' => $order->doku_order_id,
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

        session()->forget([
            'checkout.location',
            'checkout.fulfillment_type',
            'checkout.delivery_fee',
            'checkout.delivery_quote',
        ]);

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
