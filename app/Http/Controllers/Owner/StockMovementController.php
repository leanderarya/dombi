<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StockMovementController extends Controller
{
    public function index(Request $request): Response
    {
        $movements = StockMovement::query()
            ->with(['outlet', 'product', 'variant.family', 'creator'])
            ->when($request->filled('outlet_id'), fn ($query) => $query->where('outlet_id', $request->integer('outlet_id')))
            ->when($request->filled('product_id'), fn ($query) => $query->where('product_variant_id', $request->integer('product_id')))
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')->toString()))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('created_at', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('created_at', '<=', $request->date('date_to')))
            ->latest()
            ->paginate(30)
            ->withQueryString();

        return Inertia::render('owner/stock-movements/index', [
            'movements' => $movements,
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'products' => ProductVariant::with('family')
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'product_family_id']),
            'filters' => $request->only(['outlet_id', 'product_id', 'type', 'date_from', 'date_to']),
        ]);
    }
}
