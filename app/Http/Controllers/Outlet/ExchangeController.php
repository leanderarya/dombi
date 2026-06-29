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

        // Outlet inventory (what can be returned)
        $outletInventory = OutletInventory::query()
            ->where('outlet_id', $outlet->id)
            ->whereNotNull('product_variant_id')
            ->where('current_stock', '>', 0)
            ->with(['variant.family'])
            ->get()
            ->filter(fn (OutletInventory $inventory) => $inventory->variant && $inventory->variant->is_active)
            ->map(function (OutletInventory $inventory) {
                $variant = $inventory->variant;

                return [
                    'product_variant_id' => $variant->id,
                    'variant' => [
                        'id' => $variant->id,
                        'name' => $variant->full_name,
                    ],
                    'current_stock' => $inventory->current_stock,
                ];
            })
            ->values();

        // All active variants (what can be requested as replacement)
        $variants = \App\Models\ProductVariant::where('is_active', true)
            ->with('family:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (\App\Models\ProductVariant $v) => [
                'id' => $v->id,
                'name' => $v->name,
                'full_name' => $v->full_name,
                'selling_price' => $v->selling_price,
            ]);

        $pendingReturns = ReturnRequest::where('outlet_id', $outlet->id)
            ->whereIn('status', ['approved', 'received_at_center'])
            ->with('items.variant')
            ->get();

        return Inertia::render('outlet/exchanges/index', [
            'exchanges' => $exchanges,
            'filters' => $request->only(['status']),
            'outletInventory' => $outletInventory,
            'variants' => $variants,
            'pendingReturns' => $pendingReturns,
        ]);
    }

    public function create(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        // Outlet inventory (what can be returned)
        $outletInventory = OutletInventory::query()
            ->where('outlet_id', $outlet->id)
            ->whereNotNull('product_variant_id')
            ->where('current_stock', '>', 0)
            ->with(['variant.family'])
            ->get()
            ->filter(fn (OutletInventory $inventory) => $inventory->variant && $inventory->variant->is_active)
            ->map(function (OutletInventory $inventory) {
                $variant = $inventory->variant;

                return [
                    'product_variant_id' => $variant->id,
                    'variant' => [
                        'id' => $variant->id,
                        'name' => $variant->full_name,
                    ],
                    'current_stock' => $inventory->current_stock,
                ];
            })
            ->values();

        // All active variants (what can be requested as replacement)
        $variants = \App\Models\ProductVariant::where('is_active', true)
            ->with('family:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (\App\Models\ProductVariant $v) => [
                'id' => $v->id,
                'name' => $v->name,
                'full_name' => $v->full_name,
                'selling_price' => $v->selling_price,
            ]);

        $pendingReturns = ReturnRequest::where('outlet_id', $outlet->id)
            ->whereIn('status', ['approved', 'received_at_center'])
            ->with('items.variant')
            ->get();

        return Inertia::render('outlet/exchanges/create', [
            'outletInventory' => $outletInventory,
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
