<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\MarkDistributionShippedRequest;
use App\Models\Outlet;
use App\Models\StockDistribution;
use App\Services\RestockService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StockDistributionController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('owner/distributions/index', [
            'distributions' => StockDistribution::query()
                ->with(['outlet', 'restockRequest'])
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
                ->when($request->filled('outlet_id'), fn ($query) => $query->where('outlet_id', $request->integer('outlet_id')))
                ->latest()
                ->paginate(20)
                ->withQueryString(),
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'filters' => $request->only(['status', 'outlet_id']),
        ]);
    }

    public function show(StockDistribution $distribution): Response
    {
        return Inertia::render('owner/distributions/show', [
            'distribution' => $distribution->load(['outlet', 'items.product', 'restockRequest.items.product', 'sender', 'receiver']),
        ]);
    }

    public function markShipped(MarkDistributionShippedRequest $request, StockDistribution $distribution, RestockService $restockService): RedirectResponse
    {
        $restockService->markShipped($distribution, $request->user());

        return redirect()->route('owner.distributions.show', $distribution)->with('success', 'Distribution ditandai shipped.');
    }
}
