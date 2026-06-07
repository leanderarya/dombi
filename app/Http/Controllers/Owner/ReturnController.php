<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
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
        $query = ReturnRequest::with(['outlet', 'requester', 'items.variant'])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('outlet_id')) {
            $query->where('outlet_id', $request->outlet_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->filled('reason')) {
            $query->where('reason', $request->reason);
        }

        $returns = $query->paginate(20)->withQueryString();

        return Inertia::render('owner/returns/index', [
            'returns' => $returns,
            'filters' => $request->only(['status', 'outlet_id', 'date_from', 'date_to', 'reason']),
            'dashboard' => app(ReturnService::class)->getOwnerDashboard(),
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'reasons' => ReturnRequest::REASONS,
        ]);
    }

    public function show(ReturnRequest $returnRequest): Response
    {
        $returnRequest->load(['outlet', 'requester', 'reviewer', 'receiver', 'items.variant', 'statusHistories.actor']);

        return Inertia::render('owner/returns/show', [
            'return' => $returnRequest,
        ]);
    }

    public function approve(Request $request, ReturnRequest $returnRequest, ReturnService $service): RedirectResponse
    {
        $request->validate(['notes' => 'nullable|string|max:1000']);

        $service->approveRequest($returnRequest, $request->user(), $request->notes);

        return redirect()->route('owner.returns.show', $returnRequest)->with('success', 'Return request approved.');
    }

    public function reject(Request $request, ReturnRequest $returnRequest, ReturnService $service): RedirectResponse
    {
        $request->validate(['reason' => 'required|string|max:1000']);

        $service->rejectRequest($returnRequest, $request->user(), $request->reason);

        return redirect()->route('owner.returns.show', $returnRequest)->with('success', 'Return request rejected.');
    }

    public function markReceived(Request $request, ReturnRequest $returnRequest, ReturnService $service): RedirectResponse
    {
        $request->validate(['notes' => 'nullable|string|max:1000']);

        $service->markReceivedAtCenter($returnRequest, $request->user(), $request->notes);

        return redirect()->route('owner.returns.show', $returnRequest)->with('success', 'Return marked as received at center.');
    }

    public function complete(Request $request, ReturnRequest $returnRequest, ReturnService $service): RedirectResponse
    {
        $service->completeReturn($returnRequest, $request->user());

        return redirect()->route('owner.returns.show', $returnRequest)->with('success', 'Return completed and settlement adjusted.');
    }
}
