<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\ExchangeRequest;
use App\Models\OutletInventory;
use App\Models\ReturnRequest;
use App\Services\ExchangeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ExchangeController extends Controller
{
    public function index(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $query = ExchangeRequest::with(['items.variant', 'returnRequest'])
            ->where('outlet_id', $outlet->id)
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $exchanges = $query->paginate(20)->withQueryString();

        return Inertia::render('outlet/exchanges/index', [
            'exchanges' => $exchanges,
            'filters' => $request->only(['status']),
        ]);
    }

    public function create(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $variants = OutletInventory::query()
            ->where('outlet_id', $outlet->id)
            ->whereNotNull('product_variant_id')
            ->with(['variant.family'])
            ->get()
            ->filter(fn (OutletInventory $inventory) => $inventory->variant && $inventory->variant->is_active)
            ->map(function (OutletInventory $inventory) {
                $variant = $inventory->variant;

                return [
                    'id' => $variant->id,
                    'name' => $variant->name,
                    'full_name' => $variant->full_name,
                    'selling_price' => $variant->selling_price,
                    'current_stock' => $inventory->current_stock,
                    'reserved_stock' => $inventory->reserved_stock,
                    'available_stock' => $inventory->available_stock,
                ];
            })
            ->values();

        $pendingReturns = ReturnRequest::where('outlet_id', $outlet->id)
            ->whereIn('status', ['approved', 'received_at_center'])
            ->with('items.variant')
            ->get();

        return Inertia::render('outlet/exchanges/create', [
            'variants' => $variants,
            'pendingReturns' => $pendingReturns,
        ]);
    }

    public function show(ExchangeRequest $exchangeRequest): Response
    {
        $outlet = request()->user()->outlet;
        abort_unless($outlet && $outlet->id === $exchangeRequest->outlet_id, 403);

        $exchangeRequest->load(['items.variant', 'requester', 'reviewer', 'shipper', 'receiver', 'returnRequest.items.variant', 'statusHistories.actor']);

        return Inertia::render('outlet/exchanges/show', [
            'exchange' => $exchangeRequest,
        ]);
    }

    public function store(Request $request, ExchangeService $service): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $validated = $request->validate([
            'return_request_id' => 'nullable|integer|exists:return_requests,id',
            'notes' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_variant_id' => 'required|integer|exists:product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        $service->createRequest($outlet, $request->user(), $validated);

        return redirect()->route('outlet.exchanges.index')->with('success', 'Exchange request submitted.');
    }

    public function confirmReceived(Request $request, ExchangeRequest $exchangeRequest, ExchangeService $service): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $outlet->id === $exchangeRequest->outlet_id, 403);

        $request->validate(['notes' => 'nullable|string|max:1000']);

        $service->confirmReceived($exchangeRequest, $request->user(), $request->notes);

        return redirect()->route('outlet.exchanges.show', $exchangeRequest)->with('success', 'Exchange confirmed as received.');
    }

    public function cancel(Request $request, ExchangeRequest $exchangeRequest, ExchangeService $service): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $outlet->id === $exchangeRequest->outlet_id, 403);

        $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $service->cancelRequest($exchangeRequest, $request->user(), $request->reason);

        return redirect()->route('outlet.exchanges.show', $exchangeRequest)->with('success', 'Exchange request cancelled.');
    }
}
