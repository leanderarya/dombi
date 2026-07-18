<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\ApproveRestockRequest;
use App\Http\Requests\Owner\RejectRestockRequest;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\RestockRequest;
use App\Services\RestockService;
use Illuminate\Http\JsonResponse;
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
                ->with(['outlet', 'items.variant.family'])
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
                ->when($request->filled('outlet_id'), fn ($query) => $query->where('outlet_id', $request->integer('outlet_id')))
                ->when($request->filled('search'), fn ($query) => $query->where(function ($searchQuery) use ($request): void {
                    $search = $request->string('search')->toString();
                    $searchQuery
                        ->whereHas('outlet', fn ($outletQuery) => $outletQuery->where('name', 'like', "%{$search}%"))
                        ->orWhere('id', $search);
                }))
                ->when($request->filled('date'), fn ($query) => $query->whereDate('created_at', $request->date('date')))
                ->latest()
                ->paginate(20)
                ->withQueryString(),
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['status', 'outlet_id', 'search', 'date']),
            'statusOptions' => [
                ['value' => 'requested', 'label' => 'Requested'],
                ['value' => 'preparing', 'label' => 'Preparing'],
                ['value' => 'shipped', 'label' => 'Shipped'],
                ['value' => 'completed', 'label' => 'Completed'],
                ['value' => 'rejected', 'label' => 'Rejected'],
                ['value' => 'cancelled', 'label' => 'Cancelled'],
            ],
        ]);
    }

    public function show(Request $request, RestockRequest $restockRequest): Response|JsonResponse
    {
        $restockRequest->load([
            'outlet',
            'requester',
            'approver',
            'rejecter',
            'items.product',
            'items.variant.family',
            'sender',
            'receiver',
        ]);

        $inventories = OutletInventory::with('variant.family')
            ->where('outlet_id', $restockRequest->outlet_id)
            ->whereIn('product_variant_id', $restockRequest->items->pluck('product_variant_id'))
            ->get();

        if ($request->expectsJson()) {
            $centralStock = \App\Models\ProductVariant::whereIn('id', $restockRequest->items->pluck('product_variant_id'))
                ->pluck('center_stock', 'id');

            return response()->json([
                'restock' => $restockRequest,
                'inventories' => $inventories,
                'centralStock' => $centralStock,
            ]);
        }

        return Inertia::render('owner/restocks/show', [
            'restock' => $restockRequest,
            'inventories' => $inventories,
        ]);
    }

    public function approve(ApproveRestockRequest $request, RestockRequest $restockRequest, RestockService $restockService): RedirectResponse
    {
        $restockService->approveRequest($restockRequest, $request->user(), $request->validated('items'), $request->validated('owner_notes'));

        return redirect()->route('owner.restocks.show', $restockRequest)->with('success', 'Restock request disetujui.');
    }

    public function reject(RejectRestockRequest $request, RestockRequest $restockRequest, RestockService $restockService): RedirectResponse
    {
        $restockService->rejectRequest($restockRequest, $request->user(), $request->validated('rejected_reason'));

        return redirect()->route('owner.restocks.show', $restockRequest)->with('success', 'Restock request ditolak.');
    }

    public function markShipped(RestockRequest $restockRequest, RestockService $restockService): RedirectResponse
    {
        $restockService->markShipped($restockRequest, request()->user());

        return redirect()->route('owner.restocks.show', $restockRequest)->with('success', 'Restock ditandai shipped.');
    }
}
