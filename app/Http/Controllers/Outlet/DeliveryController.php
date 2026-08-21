<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Http\Requests\Outlet\UpdateExternalDeliveryRequest;
use App\Models\Delivery;
use App\Models\Order;
use App\Services\DeliveryService;
use App\Services\DeliverySlaService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DeliveryController extends Controller
{
    public function index(Request $request, DeliverySlaService $slaService): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $tab = $request->string('tab', 'aktif')->toString();
        $statusFilter = $request->string('status')->toString();

        $activeStatuses = ['waiting_pickup', 'picked_up', 'delivering'];
        $historyStatuses = ['completed', 'failed'];
        $statuses = $tab === 'riwayat' ? $historyStatuses : $activeStatuses;

        // Unassigned orders (ready_for_pickup, no delivery) — only relevant in aktif tab
        $unassignedOrders = $tab === 'riwayat'
            ? collect()
            : Order::query()
                ->where('outlet_id', $outlet->id)
                ->where('status', Order::STATUS_READY_FOR_PICKUP)
                ->whereIn('fulfillment_type', Order::DELIVERY_FULFILLMENT_TYPES)
                ->whereDoesntHave('delivery')
                ->with(['items'])
                ->orderBy('updated_at')
                ->get()
                ->map(function (Order $order) use ($slaService): array {
                    return [
                        'id' => $order->id,
                        'order_code' => $order->order_code,
                        'customer_name' => $order->customer_name,
                        'total' => $order->total,
                        'distance_km' => $order->delivery_distance_km,
                        'created_at' => $order->created_at->toIso8601String(),
                        'updated_at' => $order->updated_at->toIso8601String(),
                        'delivery_age' => $order->updated_at->diffInMinutes(now()),
                        'sla_health' => $slaService->getOrderSlaHealth($order),
                        'status' => 'waiting_assignment',
                        'type' => 'order',
                    ];
                });

        // Deliveries for this outlet
        $deliveries = Delivery::query()
            ->whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))
            ->whereIn('status', $statuses)
            ->when($statusFilter, fn ($q) => $q->where('status', $statusFilter))
            ->with(['order:id,order_code,customer_name,customer_address,total,delivery_distance_km,outlet_id', 'courier:id,name'])
            ->orderBy('updated_at', 'desc')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Delivery $d) => [
                'id' => $d->id,
                'order_code' => $d->order->order_code,
                'customer_name' => $d->order->customer_name,
                'courier' => $d->courier,
                'status' => $d->status,
                'assigned_at' => $d->assigned_at?->toIso8601String(),
                'pickup_time' => $d->pickup_time?->toIso8601String(),
                'delivered_time' => $d->delivered_time?->toIso8601String(),
                'failed_reason' => $d->failed_reason,
                'delivery_age' => $d->assigned_at ? $d->assigned_at->diffInMinutes(now()) : null,
                'sla_health' => $slaService->getSlaHealth($d),
            ]);

        $stats = [
            'needsDispatch' => $unassignedOrders->count(),
            'waitingPickup' => Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))->where('status', 'waiting_pickup')->count(),
            'inTransit' => Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))->whereIn('status', ['picked_up', 'delivering'])->count(),
            'failed' => Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))->where('status', 'failed')->count(),
        ];

        return Inertia::render('outlet/deliveries/index', [
            'outlet' => $outlet,
            'unassignedOrders' => $unassignedOrders->values(),
            'deliveries' => $deliveries,
            'stats' => $stats,
            'tab' => $tab,
            'filters' => ['status' => $statusFilter],
        ]);
    }

    public function show(Request $request, Delivery $delivery, DeliverySlaService $slaService): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $delivery->order->outlet_id === $outlet->id, 403);

        $delivery->load(['order.outlet', 'order.items.product', 'order.statusHistories.actor', 'courier', 'assignedBy', 'resolvedBy', 'statusHistories.actor']);

        return Inertia::render('outlet/deliveries/show', [
            'delivery' => [
                'id' => $delivery->id,
                'order_code' => $delivery->order->order_code,
                'customer_name' => $delivery->order->customer_name,
                'customer_address' => $delivery->order->customer_address,
                'customer_phone' => $delivery->order->customer_phone,
                'courier_type' => $delivery->courier_type,
                'external_provider' => $delivery->external_provider,
                'external_reference' => $delivery->external_reference,
                'external_courier_name' => $delivery->external_courier_name,
                'external_courier_phone' => $delivery->external_courier_phone,
                'external_plate_number' => $delivery->external_plate_number,
                'courier_cost' => (float) $delivery->courier_cost,
                'courier' => $delivery->courier,
                'assigned_by' => $delivery->assignedBy,
                'status' => $delivery->status,
                'assigned_at' => $delivery->assigned_at?->toIso8601String(),
                'pickup_time' => $delivery->pickup_time?->toIso8601String(),
                'delivered_time' => $delivery->delivered_time?->toIso8601String(),
                'failed_reason' => $delivery->failed_reason,
                'resolution_status' => $delivery->resolution_status,
                'resolution_notes' => $delivery->resolution_notes,
                'resolved_by' => $delivery->resolvedBy,
                'resolved_at' => $delivery->resolved_at?->toIso8601String(),
                'notes' => $delivery->notes,
                'proof_image' => $delivery->proof_image,
                'sla_health' => $slaService->getSlaHealth($delivery),
                'delivery_age' => $delivery->assigned_at ? $delivery->assigned_at->diffInMinutes(now()) : null,
                'order' => [
                    'id' => $delivery->order->id,
                    'total' => $delivery->order->total,
                    'outlet' => $delivery->order->outlet,
                    'items' => $delivery->order->items->map(fn ($item) => [
                        'id' => $item->id,
                        'product_name' => $item->product_name,
                        'quantity' => $item->quantity,
                        'price' => $item->price,
                        'subtotal' => $item->subtotal,
                    ]),
                    'status_histories' => $delivery->order->statusHistories->map(fn ($h) => [
                        'id' => $h->id,
                        'from_status' => $h->from_status,
                        'to_status' => $h->to_status,
                        'notes' => $h->notes,
                        'reason' => $h->reason,
                        'created_at' => $h->created_at?->toIso8601String(),
                        'actor' => $h->actor ? ['id' => $h->actor->id, 'name' => $h->actor->name] : null,
                    ]),
                ],
                'status_histories' => $delivery->statusHistories->map(fn ($h) => [
                    'id' => $h->id,
                    'from_status' => $h->from_status,
                    'to_status' => $h->to_status,
                    'changed_by_type' => $h->changed_by_type,
                    'reason' => $h->reason,
                    'notes' => $h->notes,
                    'created_at' => $h->created_at?->toIso8601String(),
                    'actor' => $h->actor ? ['id' => $h->actor->id, 'name' => $h->actor->name] : null,
                ]),
            ],
        ]);
    }

    public function confirmReturn(Request $request, Delivery $delivery, DeliveryService $deliveryService): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $delivery->order->outlet_id === $outlet->id, 403);

        $request->validate([
            'return_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $deliveryService->confirmReturn(
            $delivery,
            $request->user(),
            $request->input('return_note')
        );

        return redirect()->route('outlet.deliveries.show', $delivery)->with('success', 'Pengembalian barang dikonfirmasi.');
    }

    public function updateExternalStatus(
        UpdateExternalDeliveryRequest $request,
        Delivery $delivery,
        DeliveryService $deliveryService,
    ): RedirectResponse {
        $deliveryService->transitionExternal(
            $delivery,
            $request->user(),
            $request->validated('status'),
            $request->validated('reason'),
        );

        return redirect()
            ->route('outlet.deliveries.show', $delivery)
            ->with('success', 'Status pengiriman eksternal diperbarui.');
    }
}
