<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\ApproveRestockRequest;
use App\Http\Requests\Owner\RejectRestockRequest;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\RestockRequest;
use App\Services\RestockService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RestockController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('owner/restocks/index', [
            'restocks' => RestockRequest::query()
                ->with(['outlet', 'items.product'])
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
                ->when($request->filled('outlet_id'), fn ($query) => $query->where('outlet_id', $request->integer('outlet_id')))
                ->when($request->filled('search'), fn ($query) => $query->where(function ($searchQuery) use ($request): void {
                    $search = $request->string('search')->toString();
                    $searchQuery
                        ->whereHas('outlet', fn ($outletQuery) => $outletQuery->where('name', 'like', "%{$search}%"))
                        ->orWhere('id', $search);
                }))
                ->latest()
                ->paginate(20)
                ->withQueryString(),
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['status', 'outlet_id', 'search']),
        ]);
    }

    public function show(RestockRequest $restockRequest): Response
    {
        $restockRequest->load(['outlet', 'items.product', 'distribution.items.product']);

        return Inertia::render('owner/restocks/show', [
            'restock' => $restockRequest,
            'inventories' => OutletInventory::with('product')
                ->where('outlet_id', $restockRequest->outlet_id)
                ->whereIn('product_id', $restockRequest->items->pluck('product_id'))
                ->get(),
        ]);
    }

    public function approve(ApproveRestockRequest $request, RestockRequest $restockRequest, RestockService $restockService): RedirectResponse
    {
        $restockService->approveRequest($restockRequest, $request->user(), $request->validated('items'), $request->validated('owner_notes'));

        return redirect()->route('owner.restocks.show', $restockRequest)->with('success', 'Restock request disetujui dan distribution dibuat.');
    }

    public function reject(RejectRestockRequest $request, RestockRequest $restockRequest, RestockService $restockService): RedirectResponse
    {
        $restockService->rejectRequest($restockRequest, $request->user(), $request->validated('rejected_reason'));

        return redirect()->route('owner.restocks.show', $restockRequest)->with('success', 'Restock request ditolak.');
    }
}
