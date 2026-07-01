<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OfflineSale;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OfflineSaleController extends Controller
{
    public function index(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $sales = OfflineSale::where('outlet_id', $outlet->id)
            ->with('variant:id,name')
            ->latest()
            ->paginate(20);

        $variants = OutletInventory::where('outlet_id', $outlet->id)
            ->where('current_stock', '>', 0)
            ->with('variant:id,name,center_price')
            ->get()
            ->map(fn ($inv) => [
                'id' => $inv->variant->id,
                'name' => $inv->variant->name,
                'center_price' => (float) $inv->variant->center_price,
                'stock' => $inv->current_stock,
            ]);

        return Inertia::render('outlet/offline-sales/index', [
            'sales' => $sales,
            'variants' => $variants,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $validated = $request->validate([
            'variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $variant = ProductVariant::findOrFail($validated['variant_id']);
        $centerPrice = (float) $variant->center_price;
        $totalAmount = $centerPrice * $validated['quantity'];

        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_variant_id', $variant->id)
            ->first();

        if (!$inventory || $inventory->current_stock < $validated['quantity']) {
            throw ValidationException::withMessages([
                'quantity' => "Stok tidak mencukupi. Tersedia: {$inventory?->current_stock ?? 0}",
            ]);
        }

        DB::transaction(function () use ($outlet, $variant, $validated, $centerPrice, $totalAmount, $inventory, $request) {
            $before = $inventory->current_stock;
            $inventory->decrement('current_stock', $validated['quantity']);

            OfflineSale::create([
                'outlet_id' => $outlet->id,
                'product_variant_id' => $variant->id,
                'quantity' => $validated['quantity'],
                'center_price' => $centerPrice,
                'total_amount' => $totalAmount,
                'notes' => $validated['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            StockMovement::create([
                'outlet_id' => $outlet->id,
                'product_id' => $variant->product_id,
                'product_variant_id' => $variant->id,
                'type' => 'offline_sale',
                'quantity' => -$validated['quantity'],
                'before_stock' => $before,
                'after_stock' => $before - $validated['quantity'],
                'notes' => "Penjualan offline: {$validated['quantity']}x {$variant->name}",
                'created_by' => $request->user()->id,
            ]);
        });

        return back()->with('success', 'Penjualan offline berhasil dicatat.');
    }
}
