<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\FailDeliveryRequest;
use App\Http\Requests\Courier\RejectAssignmentRequest;
use App\Http\Requests\Courier\UpdateDeliveryStatusRequest;
use App\Models\Delivery;
use App\Services\DeliveryService;
use App\Services\RoutingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DeliveryController extends Controller
{
    public function index(Request $request): Response
    {
        $deliveries = Delivery::query()
            ->with(['order.outlet:id,name'])
            ->where('courier_id', $request->user()->id)
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('courier/deliveries/index', [
            'deliveries' => $deliveries,
            'filters' => $request->only(['status']),
        ]);
    }

    public function show(UpdateDeliveryStatusRequest $request, Delivery $delivery): Response
    {
        $delivery->load(['order.outlet', 'order.items.product', 'order.statusHistories.actor', 'courier', 'statusHistories']);

        return Inertia::render('courier/deliveries/show', [
            'delivery' => [
                'id' => $delivery->id,
                'status' => $delivery->status,
                'pickup_time' => $delivery->pickup_time?->toISOString(),
                'delivered_time' => $delivery->delivered_time?->toISOString(),
                'assigned_at' => $delivery->assigned_at?->toISOString(),
                'failed_reason' => $delivery->failed_reason,
                'notes' => $delivery->notes,
                'proof_image' => $delivery->proof_image,
                'delivered_to' => $delivery->delivered_to,
                'delivery_note' => $delivery->delivery_note,
                'rejection_reason' => $delivery->rejection_reason,
                'rejection_note' => $delivery->rejection_note,
                'return_status' => $delivery->return_status,
                'return_notes' => $delivery->return_notes,
                'courier' => $delivery->courier ? [
                    'id' => $delivery->courier->id,
                    'name' => $delivery->courier->name,
                ] : null,
                'order' => [
                    'id' => $delivery->order->id,
                    'order_code' => $delivery->order->order_code,
                    'customer_name' => $delivery->order->customer_name,
                    'customer_phone' => $delivery->order->customer_phone,
                    'customer_address' => $delivery->order->customer_address,
                    'customer_address_detail' => $delivery->order->customer_address_detail,
                    'customer_landmark' => $delivery->order->customer_landmark,
                    'latitude' => $delivery->order->latitude,
                    'longitude' => $delivery->order->longitude,
                    'notes' => $delivery->order->notes,
                    'total' => (float) $delivery->order->total,
                    'outlet' => $delivery->order->outlet ? [
                        'id' => $delivery->order->outlet->id,
                        'name' => $delivery->order->outlet->name,
                        'address' => $delivery->order->outlet->address,
                        'latitude' => $delivery->order->outlet->latitude,
                        'longitude' => $delivery->order->outlet->longitude,
                        'phone' => $delivery->order->outlet->phone,
                    ] : null,
                    'items' => $delivery->order->items->map(fn ($item) => [
                        'id' => $item->id,
                        'product_name' => $item->product_name,
                        'quantity' => $item->quantity,
                        'price' => (float) $item->price,
                        'subtotal' => (float) $item->subtotal,
                    ]),
                ],
                'status_histories' => $delivery->statusHistories->map(fn ($h) => [
                    'id' => $h->id,
                    'from_status' => $h->from_status,
                    'to_status' => $h->to_status,
                    'reason' => $h->reason,
                    'notes' => $h->notes,
                    'created_at' => $h->created_at?->toISOString(),
                    'actor' => $h->actor ? ['name' => $h->actor->name] : null,
                ]),
            ],
        ]);
    }

    public function confirmPickup(UpdateDeliveryStatusRequest $request, Delivery $delivery, DeliveryService $deliveryService): RedirectResponse
    {
        $deliveryService->confirmPickup($delivery, $request->user());

        return redirect()->route('courier.deliveries.show', $delivery)->with('success', 'Pickup berhasil dikonfirmasi.');
    }

    public function startDelivery(UpdateDeliveryStatusRequest $request, Delivery $delivery, DeliveryService $deliveryService): RedirectResponse
    {
        $deliveryService->startDelivery($delivery, $request->user());

        return redirect()->route('courier.deliveries.show', $delivery)->with('success', 'Delivery dimulai.');
    }

    public function complete(UpdateDeliveryStatusRequest $request, Delivery $delivery, DeliveryService $deliveryService): RedirectResponse
    {
        $payload = $request->validated();

        if ($request->hasFile('proof_image')) {
            $payload['proof_image'] = $request->file('proof_image')->store('delivery-proofs', 'public');
        }

        $deliveryService->completeDelivery($delivery, $request->user(), $payload);

        return redirect()->route('courier.deliveries.show', $delivery)->with('success', 'Delivery selesai.');
    }

    public function fail(FailDeliveryRequest $request, Delivery $delivery, DeliveryService $deliveryService): RedirectResponse
    {
        $deliveryService->failDelivery(
            $delivery,
            $request->user(),
            $request->validated('failed_reason'),
            $request->validated('failure_note')
        );

        return redirect()->route('courier.deliveries.show', $delivery)->with('success', 'Delivery ditandai gagal.');
    }

    public function reject(RejectAssignmentRequest $request, Delivery $delivery, DeliveryService $deliveryService): RedirectResponse
    {
        $deliveryService->rejectAssignment(
            $delivery,
            $request->user(),
            $request->validated('rejection_reason'),
            $request->validated('rejection_note')
        );

        return redirect()->route('courier.dashboard')->with('success', 'Assignment ditolak.');
    }

    public function returnToOutlet(Request $request, Delivery $delivery, DeliveryService $deliveryService): RedirectResponse
    {
        $request->validate([
            'return_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $deliveryService->returnToOutlet(
            $delivery,
            $request->user(),
            $request->input('return_note')
        );

        return redirect()->route('courier.deliveries.show', $delivery)->with('success', 'Mengembalikan pesanan ke outlet.');
    }

    public function getOptimizedRoute(Request $request, RoutingService $routingService): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === 'courier', 403);

        $deliveries = Delivery::where('courier_id', $user->id)
            ->whereIn('status', ['waiting_pickup', 'picked_up'])
            ->with('order')
            ->get();

        if ($deliveries->isEmpty()) {
            return response()->json([
                'route' => [],
                'summary' => ['total_distance_km' => 0, 'estimated_minutes' => 0, 'stops' => 0],
            ]);
        }

        $startLat = $deliveries->first()->order->latitude ?? -7.0568;
        $startLng = $deliveries->first()->order->longitude ?? 110.4381;

        $optimizedRoute = $routingService->calculateOptimizedRoute($deliveries->all(), $startLat, $startLng);
        $summary = $routingService->getRouteSummary($optimizedRoute, $startLat, $startLng);

        return response()->json([
            'route' => collect($optimizedRoute)->map(fn ($d) => [
                'id' => $d->id,
                'order_code' => $d->order->order_code,
                'customer_name' => $d->order->customer_name,
                'address' => $d->order->customer_address,
                'latitude' => $d->order->latitude,
                'longitude' => $d->order->longitude,
                'status' => $d->status,
            ]),
            'summary' => $summary,
        ]);
    }
}
