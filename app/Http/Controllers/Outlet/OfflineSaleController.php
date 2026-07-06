<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OfflineSale;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\ProductVariant;
use App\Models\Settlement;
use App\Models\StockMovement;
use App\Services\SettlementGeneratorService;
use Carbon\Carbon;
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
            ->with(['variant' => function ($q) {
                $q->select('id', 'product_family_id', 'name')
                    ->with('family:id,name');
            }])
            ->latest()
            ->paginate(20);

        $variants = OutletInventory::where('outlet_id', $outlet->id)
            ->where('current_stock', '>', 0)
            ->with(['variant' => function ($q) {
                $q->select('id', 'product_family_id', 'name', 'center_price')
                    ->with('family:id,name');
            }])
            ->get()
            ->map(fn ($inv) => [
                'id' => $inv->variant->id,
                'name' => $inv->variant->family->name.' - '.$inv->variant->name,
                'center_price' => (float) $inv->variant->center_price,
                'stock' => $inv->current_stock,
            ]);

        return Inertia::render('outlet/offline-sales/index', [
            'sales' => $sales,
            'variants' => $variants,
        ]);
    }

    public function store(Request $request, SettlementGeneratorService $settlementGenerator): RedirectResponse
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

        if (! $inventory || $inventory->current_stock < $validated['quantity']) {
            $available = $inventory?->current_stock ?? 0;
            throw ValidationException::withMessages([
                'quantity' => "Stok tidak mencukupi. Tersedia: {$available}",
            ]);
        }

        DB::transaction(function () use ($outlet, $variant, $validated, $centerPrice, $totalAmount, $inventory, $request, $settlementGenerator) {
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

            // Audit trail in outlet_payables
            OutletPayable::create([
                'outlet_id' => $outlet->id,
                'type' => 'sale',
                'amount' => $totalAmount,
                'center_share' => $totalAmount,
                'outlet_margin' => 0,
                'due_date' => now()->endOfWeek(Carbon::SUNDAY)->addDays(7)->toDateString(),
                'paid_amount' => 0,
                'remaining_amount' => $totalAmount,
                'notes' => "Penjualan offline: {$validated['quantity']}x {$variant->name}",
                'created_by' => $request->user()->id,
            ]);

            // Upsert weekly settlement via generator (single source of truth)
            $settlementGenerator->generateForOutlet($outlet, now());
        });

        return back()->with('success', 'Penjualan offline berhasil dicatat.');
    }

    public function destroy(Request $request, OfflineSale $offlineSale, SettlementGeneratorService $settlementGenerator): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $offlineSale->outlet_id === $outlet->id, 403);

        DB::transaction(function () use ($outlet, $offlineSale, $settlementGenerator) {
            // Reverse stock
            $inventory = OutletInventory::where('outlet_id', $outlet->id)
                ->where('product_variant_id', $offlineSale->product_variant_id)
                ->first();

            if ($inventory) {
                $inventory->increment('current_stock', $offlineSale->quantity);
            }

            // Delete related stock movement
            StockMovement::where('outlet_id', $outlet->id)
                ->where('product_variant_id', $offlineSale->product_variant_id)
                ->where('type', 'offline_sale')
                ->where('quantity', -$offlineSale->quantity)
                ->where('created_by', $offlineSale->created_by)
                ->where('created_at', $offlineSale->created_at)
                ->delete();

            // Delete related outlet payable (audit trail)
            // Use exact notes match to avoid false positives (e.g. "10x" matching "100x")
            OutletPayable::where('outlet_id', $outlet->id)
                ->where('type', 'sale')
                ->where('notes', "Penjualan offline: {$offlineSale->quantity}x {$offlineSale->variant->name}")
                ->where('created_by', $offlineSale->created_by)
                ->delete();

            // Delete the sale
            $offlineSale->delete();

            // Recalculate weekly settlement from remaining orders (source of truth)
            $settlementGenerator->recalculateForWeek($outlet, $offlineSale->created_at);
        });

        return back()->with('success', 'Penjualan offline berhasil dihapus.');
    }
}
