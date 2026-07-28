<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\ExchangeRequest;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ReturnRequest;
use App\Services\ExchangeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class ExchangeController extends Controller
{
    public function index(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $query = ExchangeRequest::with(['items.product', 'returnRequest'])
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

        $returnRequests = ReturnRequest::with(['items.product'])
            ->where('outlet_id', $outlet->id)
            ->where('status', 'approved')
            ->get();

        $products = $this->getOutletInventory($outlet->id);

        return Inertia::render('outlet/exchanges/create', [
            'returnRequests' => $returnRequests,
            'products' => $products,
        ]);
    }

    public function show(Request $request, ExchangeRequest $exchangeRequest): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $outlet->id === $exchangeRequest->outlet_id, 403);

        $exchangeRequest->load(['items.product', 'requester', 'reviewer', 'shipper', 'receiver', 'returnRequest.items.product', 'statusHistories.actor']);

        return Inertia::render('outlet/exchanges/show', [
            'exchange' => $exchangeRequest,
        ]);
    }

    public function store(Request $request, ExchangeService $service): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $validated = $request->validate([
            'return_request_id' => 'required|integer|exists:return_requests,id',
            'notes' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
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

    private function getOutletInventory(int $outletId): Collection
    {
        return OutletInventory::query()
            ->where('outlet_id', $outletId)
            ->where('current_stock', '>', 0)
            ->with(['product.category'])
            ->get()
            ->filter(fn (OutletInventory $inventory) => $inventory->product && $inventory->product->is_active)
            ->map(function (OutletInventory $inventory) {
                $product = $inventory->product;

                return [
                    'product_id' => $product->id,
                    'variant' => [
                        'id' => $product->id,
                        'name' => $product->name,
                    ],
                    'current_stock' => $inventory->current_stock,
                ];
            })
            ->values();
    }

    private function getActiveProducts(): Collection
    {
        return Product::where('is_active', true)
            ->with('category:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'name' => $p->full_display_name,
                'category' => $p->category?->name,
            ]);
    }
}
