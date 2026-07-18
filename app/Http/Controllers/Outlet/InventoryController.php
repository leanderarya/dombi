<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OutletInventory;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\RestockRequest;
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

        $activeRequests = RestockRequest::where('outlet_id', $outlet->id)
            ->whereIn('status', ['requested', 'preparing', 'shipped'])
            ->with('items')
            ->latest()
            ->get();

        $activeMap = [];
        foreach ($activeRequests as $req) {
            foreach ($req->items as $item) {
                $vid = $item->product_variant_id;
                if (!isset($activeMap[$vid])) {
                    $activeMap[$vid] = [
                        'id' => $req->id,
                        'status' => $req->status,
                        'requested_qty' => $item->requested_quantity,
                        'approved_qty' => $item->approved_quantity ?? 0,
                        'created_at' => $req->created_at->toIsoString(),
                    ];
                }
            }
        }

        $recentRestocks = RestockRequest::where('outlet_id', $outlet->id)
            ->with(['items.variant.family'])
            ->latest()
            ->limit(10)
            ->get();

        return Inertia::render('outlet/inventory', [
            'outlet' => $outlet,
            'inventories' => OutletInventory::with(['variant.family', 'product'])
                ->where('outlet_id', $outlet->id)
                ->orderBy('product_variant_id')
                ->get(),
            'families' => $families,
            'centerStocks' => $centerStocks,
            'activeRestocks' => $activeMap,
            'recentRestocks' => $recentRestocks,
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
