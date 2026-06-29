<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OutletInventory;
use App\Models\ProductFamily;
use App\Models\StockMovement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        return Inertia::render('outlet/inventory', [
            'outlet' => $outlet,
            'inventories' => OutletInventory::with(['variant.family', 'product'])
                ->where('outlet_id', $outlet->id)
                ->orderBy('product_variant_id')
                ->get(),
            'families' => $families,
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
        $difference = $actualCount - $systemCount;

        if ($difference === 0) {
            return back()->with('success', 'Stok sesuai. Tidak ada perubahan.');
        }

        DB::transaction(function () use ($inventory, $actualCount, $difference, $validated, $user) {
            $before = $inventory->current_stock;
            $inventory->update(['current_stock' => $actualCount]);

            StockMovement::create([
                'outlet_id' => $inventory->outlet_id,
                'product_id' => $inventory->product_id,
                'product_variant_id' => $inventory->product_variant_id,
                'type' => 'stock_opname',
                'quantity' => $difference,
                'before_stock' => $before,
                'after_stock' => $actualCount,
                'notes' => $validated['notes'] ?? "Stock opname: {$before} → {$actualCount}",
                'created_by' => $user->id,
            ]);
        });

        return back()->with('success', "Stok berhasil diperbarui: {$systemCount} → {$actualCount}");
    }
}
