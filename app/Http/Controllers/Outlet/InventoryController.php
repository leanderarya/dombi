<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OutletInventory;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function __invoke(): Response
    {
        $outlet = auth()->user()->outlet;
        abort_unless($outlet, 403);

        $families = ProductFamily::where('is_active', true)
            ->with(['variants' => fn ($q) => $q->where('is_active', true)->orderBy('name')])
            ->orderBy('name')
            ->get();

        $centerStocks = ProductVariant::pluck('center_stock', 'id');

        return Inertia::render('outlet/inventory', [
            'outlet' => $outlet,
            'inventories' => OutletInventory::with(['variant.family', 'product'])
                ->where('outlet_id', $outlet->id)
                ->orderBy('product_variant_id')
                ->get(),
            'families' => $families,
            'centerStocks' => $centerStocks,
        ]);
    }

    public function opname(Request $request): RedirectResponse
    {
        $user = $request->user();
        $outlet = $user->outlet;
        abort_unless($outlet, 403);

        $validated = $request->validate([
            'product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'actual_count' => ['required', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_variant_id', $validated['product_variant_id'])
            ->firstOrFail();

        $systemCount = $inventory->current_stock;
        $actualCount = $validated['actual_count'];

        if ($actualCount === $systemCount) {
            return back()->with('success', 'Stok sesuai. Tidak ada perubahan.');
        }

        app(InventoryService::class)->stockOpname(
            $outlet->id,
            $validated['product_variant_id'],
            $actualCount,
            $validated['notes'] ?? null,
        );

        return back()->with('success', "Stok berhasil diperbarui: {$systemCount} → {$actualCount}");
    }
}
