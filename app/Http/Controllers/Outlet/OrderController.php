<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignCourierRequest;
use App\Http\Requests\Outlet\RejectOrderRequest;
use App\Http\Requests\Outlet\UpdateOrderStatusRequest;
use App\Models\Order;
use App\Models\User;
use App\Services\DeliveryService;
use App\Services\OrderStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $tab = $request->string('tab', 'aktif')->toString();

        $operationalStatuses = [
            'pending_confirmation', 'confirmed', 'preparing',
            'ready_for_pickup', 'picked_up', 'delivering',
        ];
        $historyStatuses = [
            'completed', 'cancelled_by_customer', 'cancelled_by_outlet',
            'rejected_by_outlet', 'failed_delivery', 'expired',
        ];

        $statuses = $tab === 'riwayat' ? $historyStatuses : $operationalStatuses;

        $orders = Order::query()
            ->where('outlet_id', $outlet->id)
            ->whereIn('status', $statuses)
            // Only show paid orders to outlet — hide unpaid orders
            ->when($tab === 'aktif', fn ($q) => $q
                ->where('payment_status', 'paid')
            )
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($tab === 'aktif', fn ($q) => $q
                ->where(function ($q) {
                    $q->where('status', '!=', 'pending_confirmation')
                        ->orWhere(function ($q2) {
                            $q2->whereNull('confirmation_expires_at')
                                ->orWhere('confirmation_expires_at', '>', now());
                        });
                })
                ->oldest(),
                fn ($q) => $q->latest()
            )
            ->with('items')
            ->paginate(20)
            ->withQueryString();

        $pendingCount = Cache::remember(
            "outlet:{$outlet->id}:pending_orders",
            5,
            fn () => Order::where('outlet_id', $outlet->id)
                ->where('status', 'pending_confirmation')
                ->where('payment_status', 'paid')
                ->where(function ($q) {
                    $q->whereNull('confirmation_expires_at')
                        ->orWhere('confirmation_expires_at', '>', now());
                })
                ->count()
        );

        return Inertia::render('outlet/orders/index', [
            'outlet' => $outlet,
            'orders' => $orders,
            'filters' => $request->only(['status', 'tab']),
            'tab' => $tab,
            'pendingCount' => $pendingCount,
        ]);
    }

    public function show(Request $request, Order $order): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $order->outlet_id === $outlet->id, 403);

        return Inertia::render('outlet/orders/show', [
            'order' => $order->load(['items.product', 'statusHistories.actor', 'delivery.courier']),
            'couriers' => User::where('role', 'courier')->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'rejectionReasons' => OrderStatusService::rejectionReasons(),
            'cancellationReasons' => OrderStatusService::outletCancellationReasons(),
        ]);
    }

    public function updateStatus(UpdateOrderStatusRequest $request, Order $order, OrderStatusService $orderStatusService): RedirectResponse
    {
        $orderStatusService->updateStatus($order, $request->validated('status'), $request->user(), $request->validated('reason'));

        return redirect()->route('outlet.orders.show', $order)->with('success', 'Status order berhasil diperbarui.');
    }

    public function reject(RejectOrderRequest $request, Order $order, OrderStatusService $orderStatusService): RedirectResponse
    {
        $validated = $request->validated();
        $orderStatusService->rejectOrder($order, $validated['reason'], $validated['note'] ?? null, $request->user());

        return redirect()->route('outlet.orders.show', $order)->with('success', 'Pesanan berhasil ditolak.');
    }

    public function completePickup(Request $request, Order $order, OrderStatusService $statusService): RedirectResponse
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet && $order->outlet_id === $outlet->id, 403);

        $statusService->completePickup($order, $user);

        return redirect()->route('outlet.orders.show', $order)
            ->with('success', 'Pesanan berhasil diserahkan ke customer.');
    }

    public function assignCourier(AssignCourierRequest $request, Order $order, DeliveryService $deliveryService): RedirectResponse
    {
        $courier = User::findOrFail($request->integer('courier_id'));
        $deliveryService->assignCourier($order, $courier, $request->user());

        return redirect()->route('outlet.orders.show', $order)->with('success', 'Kurir berhasil di-assign.');
    }

    public function pendingCount(Request $request): JsonResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $count = Cache::remember(
            "outlet:{$outlet->id}:pending_orders",
            5,
            fn () => Order::where('outlet_id', $outlet->id)
                ->where('status', 'pending_confirmation')
                ->where('payment_status', 'paid')
                ->where(function ($q) {
                    $q->whereNull('confirmation_expires_at')
                        ->orWhere('confirmation_expires_at', '>', now());
                })
                ->count()
        );

        return response()->json(['pending_count' => $count]);
    }
}
