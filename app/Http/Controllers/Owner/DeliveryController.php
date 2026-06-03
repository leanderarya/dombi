<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignCourierRequest;
use App\Http\Requests\Owner\ResolveDeliveryRequest;
use App\Models\Delivery;
use App\Models\Order;
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
            ->when($request->filled('search'), fn ($query) => $query->whereHas('order', fn ($orderQuery) => $orderQuery->where('order_code', 'like', '%'.$request->string('search')->toString().'%')))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('owner/deliveries/index', [
            'deliveries' => $deliveries,
            'couriers' => User::where('role', 'courier')->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['status', 'courier_id', 'search']),
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
        $courier = User::findOrFail($request->integer('courier_id'));
        $deliveryService->assignCourier($order, $courier, $request->user());

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
