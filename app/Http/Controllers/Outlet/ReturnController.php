<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OutletInventory;
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

        $query = ReturnRequest::with(['items.variant'])
            ->where('outlet_id', $outlet->id)
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $returns = $query->paginate(20)->withQueryString();

        return Inertia::render('outlet/returns/index', [
            'returns' => $returns,
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

        return Inertia::render('outlet/returns/create', [
            'variants' => $variants,
            'reasons' => ReturnRequest::REASONS,
        ]);
    }

    public function show(ReturnRequest $returnRequest): Response
    {
        $outlet = request()->user()->outlet;
        abort_unless($outlet && $outlet->id === $returnRequest->outlet_id, 403);

        $returnRequest->load(['items.variant', 'requester', 'reviewer', 'receiver', 'statusHistories.actor', 'exchangeRequest']);

        return Inertia::render('outlet/returns/show', [
            'return' => $returnRequest,
        ]);
    }

    public function store(Request $request, ReturnService $service): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $validated = $request->validate([
            'reason' => 'required|string|in:' . implode(',', array_keys(ReturnRequest::REASONS)),
            'notes' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.product_variant_id' => 'required|integer|exists:product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        $service->createRequest($outlet, $request->user(), $validated);

        return redirect()->route('outlet.returns.index')->with('success', 'Return request submitted.');
    }
}
