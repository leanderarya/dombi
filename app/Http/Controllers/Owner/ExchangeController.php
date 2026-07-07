<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\ExchangeRequest;
use App\Models\Outlet;
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
        $query = ExchangeRequest::with(['outlet', 'requester', 'items.variant', 'returnRequest'])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('outlet_id')) {
            $query->where('outlet_id', $request->outlet_id);
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery->where('id', $search)
                    ->orWhereHas('outlet', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('date')) {
            $query->whereDate('created_at', $request->date('date'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->filled('reason')) {
            $query->whereHas('returnRequest', fn ($returnQuery) => $returnQuery->where('reason', $request->reason));
        }

        $exchanges = $query->paginate(20)->withQueryString();

        return Inertia::render('owner/exchanges/index', [
            'exchanges' => $exchanges,
            'filters' => $request->only(['status', 'outlet_id', 'search', 'date', 'date_from', 'date_to', 'reason']),
            'dashboard' => app(ExchangeService::class)->getOwnerDashboard(),
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'reasons' => ReturnRequest::REASONS,
        ]);
    }

    public function show(ExchangeRequest $exchangeRequest): Response
    {
        $exchangeRequest->load(['outlet', 'requester', 'reviewer', 'shipper', 'receiver', 'items.variant', 'returnRequest.items.variant', 'statusHistories.actor']);

        return Inertia::render('owner/exchanges/show', [
            'exchange' => $exchangeRequest,
        ]);
    }

    public function approve(Request $request, ExchangeRequest $exchangeRequest, ExchangeService $service): RedirectResponse
    {
        $request->validate(['notes' => 'nullable|string|max:1000']);

        $service->approveRequest($exchangeRequest, $request->user(), $request->notes);

        return redirect()->route('owner.exchanges.show', $exchangeRequest)->with('success', 'Exchange request approved.');
    }

    public function reject(Request $request, ExchangeRequest $exchangeRequest, ExchangeService $service): RedirectResponse
    {
        $request->validate(['reason' => 'required|string|max:1000']);

        $service->rejectRequest($exchangeRequest, $request->user(), $request->reason);

        return redirect()->route('owner.exchanges.show', $exchangeRequest)->with('success', 'Exchange request rejected.');
    }

    /**
     * Optional: not called from the UI. Kept for API flexibility.
     */
    public function markPreparing(Request $request, ExchangeRequest $exchangeRequest, ExchangeService $service): RedirectResponse
    {
        $service->markPreparing($exchangeRequest, $request->user());

        return redirect()->route('owner.exchanges.show', $exchangeRequest)->with('success', 'Exchange marked as preparing.');
    }

    public function markShipped(Request $request, ExchangeRequest $exchangeRequest, ExchangeService $service): RedirectResponse
    {
        $service->markShipped($exchangeRequest, $request->user());

        return redirect()->route('owner.exchanges.show', $exchangeRequest)->with('success', 'Exchange marked as shipped.');
    }

    public function complete(Request $request, ExchangeRequest $exchangeRequest, ExchangeService $service): RedirectResponse
    {
        $service->completeExchange($exchangeRequest, $request->user());

        return redirect()->route('owner.exchanges.show', $exchangeRequest)->with('success', 'Exchange completed.');
    }
}
