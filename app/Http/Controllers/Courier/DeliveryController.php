<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\FailDeliveryRequest;
use App\Http\Requests\Courier\UpdateDeliveryStatusRequest;
use App\Models\Delivery;
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
            ->with(['order.outlet'])
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
        return Inertia::render('courier/deliveries/show', [
            'delivery' => $delivery->load(['order.outlet', 'order.items.product', 'order.statusHistories.actor', 'courier']),
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
        $deliveryService->completeDelivery($delivery, $request->user(), $request->validated());

        return redirect()->route('courier.deliveries.show', $delivery)->with('success', 'Delivery selesai.');
    }

    public function fail(FailDeliveryRequest $request, Delivery $delivery, DeliveryService $deliveryService): RedirectResponse
    {
        $deliveryService->failDelivery($delivery, $request->user(), $request->validated('failed_reason'));

        return redirect()->route('courier.deliveries.show', $delivery)->with('success', 'Delivery ditandai gagal.');
    }
}
