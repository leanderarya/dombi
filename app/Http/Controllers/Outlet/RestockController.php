<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Http\Requests\Outlet\ConfirmDistributionReceivedRequest;
use App\Http\Requests\Outlet\StoreRestockRequest;
use App\Models\OutletInventory;
use App\Models\ProductFamily;
use App\Models\RestockRequest;
use App\Models\StockDistribution;
use App\Services\RestockService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RestockController extends Controller
{
    public function index(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        return Inertia::render('outlet/restocks/index', [
            'restocks' => RestockRequest::query()
                ->with('distribution')
                ->where('outlet_id', $outlet->id)
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
                ->latest()
                ->paginate(20)
                ->withQueryString(),
            'filters' => $request->only('status'),
        ]);
    }

    public function create(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $families = ProductFamily::where('is_active', true)
            ->with(['variants' => fn ($q) => $q->where('is_active', true)->orderBy('name')])
            ->orderBy('name')
            ->get();

        return Inertia::render('outlet/restocks/create', [
            'families' => $families,
            'inventories' => OutletInventory::with('variant.family')
                ->where('outlet_id', $outlet->id)
                ->get(),
        ]);
    }

    public function store(StoreRestockRequest $request, RestockService $restockService): RedirectResponse
    {
        $restock = $restockService->createRequest($request->user(), $request->validated());

        return redirect()->route('outlet.restocks.show', $restock)->with('success', 'Restock request berhasil dibuat.');
    }

    public function show(Request $request, RestockRequest $restockRequest): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $restockRequest->outlet_id === $outlet->id, 403);

        return Inertia::render('outlet/restocks/show', [
            'restock' => $restockRequest->load(['outlet', 'items.variant.family', 'distribution.items.variant.family']),
        ]);
    }

    public function confirmReceived(ConfirmDistributionReceivedRequest $request, StockDistribution $distribution, RestockService $restockService): RedirectResponse
    {
        $restockService->confirmReceived($distribution, $request->user());

        return redirect()->back()->with('success', 'Stok diterima dan inventory diperbarui.');
    }
}
