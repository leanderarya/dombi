<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ReturnRequest;
use App\Services\ReturnService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReturnController extends Controller
{
    public function index(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $query = ReturnRequest::with(['items.product'])
            ->where('outlet_id', $outlet->id)
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $returns = $query->paginate(20)->withQueryString();

        $products = OutletInventory::query()
            ->where('outlet_id', $outlet->id)
            ->whereNotNull('product_id')
            ->with(['product.category'])
            ->get()
            ->filter(fn (OutletInventory $inventory) => $inventory->product && $inventory->product->is_active)
            ->map(function (OutletInventory $inventory) {
                $product = $inventory->product;

                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'full_name' => $product->full_display_name,
                    'selling_price' => $product->selling_price,
                    'current_stock' => $inventory->current_stock,
                    'available_stock' => $inventory->available_stock,
                ];
            })
            ->values();

        return Inertia::render('outlet/returns/index', [
            'returns' => $returns,
            'filters' => $request->only(['status']),
            'variants' => $products,
            'reasons' => ReturnRequest::REASONS,
        ]);
    }

    public function create(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $products = OutletInventory::query()
            ->where('outlet_id', $outlet->id)
            ->whereNotNull('product_id')
            ->with(['product.category'])
            ->get()
            ->filter(fn (OutletInventory $inventory) => $inventory->product && $inventory->product->is_active)
            ->map(function (OutletInventory $inventory) {
                $product = $inventory->product;

                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'full_name' => $product->full_display_name,
                    'selling_price' => $product->selling_price,
                    'current_stock' => $inventory->current_stock,
                    'reserved_stock' => $inventory->reserved_stock,
                    'available_stock' => $inventory->available_stock,
                ];
            })
            ->values();

        return Inertia::render('outlet/returns/create', [
            'variants' => $products,
            'reasons' => ReturnRequest::REASONS,
        ]);
    }

    public function show(Request $request, ReturnRequest $returnRequest): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $outlet->id === $returnRequest->outlet_id, 403);

        $returnRequest->load(['items.product', 'requester', 'reviewer', 'receiver', 'statusHistories.actor', 'exchangeRequest']);

        return Inertia::render('outlet/returns/show', [
            'return' => $returnRequest,
        ]);
    }

    public function store(Request $request, ReturnService $service): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $validated = $request->validate([
            'reason' => 'required|string|in:'.implode(',', array_keys(ReturnRequest::REASONS)),
            'notes' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'evidence_images' => 'nullable|array|max:5',
            'evidence_images.*' => 'image|mimes:jpeg,png,jpg|max:5120',
        ]);

        $evidenceImages = $request->file('evidence_images', []);
        $service->createRequest($outlet, $request->user(), $validated, $evidenceImages);

        return redirect()->route('outlet.returns.index')->with('success', 'Return request submitted.');
    }

    public function cancel(Request $request, ReturnRequest $returnRequest, ReturnService $service): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $outlet->id === $returnRequest->outlet_id, 403);

        $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $service->cancelRequest($returnRequest, $request->user(), $request->reason);

        return redirect()->route('outlet.returns.show', $returnRequest)->with('success', 'Return request cancelled.');
    }
}
