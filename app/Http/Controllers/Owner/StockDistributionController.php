<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\MarkDistributionShippedRequest;
use App\Models\Outlet;
use App\Models\StockDistribution;
use App\Services\RestockService;
use Illuminate\Http\JsonResponse;
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
        ]);
    }

    public function show(Request $request, StockDistribution $distribution): Response|JsonResponse
    {
        $distribution->load(['outlet', 'items.variant.family', 'restockRequest.items.variant.family', 'sender', 'receiver']);

        if ($request->expectsJson()) {
            return response()->json(['distribution' => $distribution]);
        }

        return Inertia::render('owner/distributions/show', [
            'distribution' => $distribution,
        ]);
    }

    public function markShipped(MarkDistributionShippedRequest $request, StockDistribution $distribution, RestockService $restockService): RedirectResponse
    {
        $restockService->markShipped($distribution, $request->user());

        return redirect()->route('owner.distributions.show', $distribution)->with('success', 'Distribution ditandai shipped.');
    }
}
