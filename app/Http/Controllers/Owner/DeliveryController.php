<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignCourierRequest;
use App\Http\Requests\Owner\ResolveDeliveryRequest;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\DeliveryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DeliveryController extends Controller
{
    public function index(Request $request): Response
    {
        $deliveries = Delivery::query()
            ->with(['order.outlet', 'courier'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
            ->when($request->filled('courier_id'), fn ($query) => $query->where('courier_id', $request->integer('courier_id')))
            ->when($request->filled('outlet_id'), fn ($query) => $query->whereHas('order', fn ($orderQuery) => $orderQuery->where('outlet_id', $request->integer('outlet_id'))))
            ->when($request->filled('search'), fn ($query) => $query->whereHas('order', fn ($orderQuery) => $orderQuery->where('order_code', 'like', '%'.$request->string('search')->toString().'%')))
            ->when($request->filled('date'), fn ($query) => $query->whereDate('created_at', $request->date('date')))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        $todayStart = today();
        $stats = [
            'total_today' => Delivery::where('updated_at', '>=', $todayStart)->count(),
            'active' => Delivery::whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])->count(),
            'completed_today' => Delivery::where('status', 'completed')->where('updated_at', '>=', $todayStart)->count(),
            'failed_today' => Delivery::where('status', 'failed')->where('updated_at', '>=', $todayStart)->count(),
        ];

        return Inertia::render('owner/deliveries/index', [
            'deliveries' => $deliveries,
            'couriers' => User::where('role', 'courier')->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['status', 'courier_id', 'outlet_id', 'search', 'date']),
            'stats' => $stats,
        ]);
    }

    public function show(Delivery $delivery): Response
    {
        return Inertia::render('owner/deliveries/show', [
            'delivery' => $delivery->load(['order.outlet', 'order.items.product', 'order.statusHistories.actor', 'courier', 'assignedBy', 'resolvedBy']),
        ]);
    }

    public function assignCourier(AssignCourierRequest $request, Order $order, DeliveryService $deliveryService): RedirectResponse
    {
        $courierType = $request->validated('courier_type');
        $courier = $courierType === 'dombi' ? User::findOrFail($request->integer('courier_id')) : null;

        $deliveryService->assignCourier(
            order: $order,
            courier: $courier,
            assignedBy: $request->user(),
            courierType: $courierType,
            externalName: $request->validated('external_courier_name'),
            externalPhone: $request->validated('external_courier_phone'),
            externalPlate: $request->validated('external_plate_number'),
            courierCost: $request->float('courier_cost'),
        );

        return redirect()->route('owner.orders.show', $order)->with('success', 'Kurir berhasil di-assign.');
    }

    public function resolve(ResolveDeliveryRequest $request, Delivery $delivery, DeliveryService $deliveryService): RedirectResponse
    {
        $deliveryService->resolveFailedDelivery(
            $delivery,
            $request->user(),
            $request->validated('resolution'),
            $request->validated('resolution_notes'),
        );

        // Always redirect back to the order — resolution is part of order lifecycle
        return redirect()->route('owner.orders.show', $delivery->order_id)->with('success', 'Delivery berhasil di-resolve.');
    }
}
