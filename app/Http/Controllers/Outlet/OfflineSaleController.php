<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OfflineSale;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\SettlementGeneratorService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
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
            ->with(['product' => function ($q) {
                $q->select('id', 'product_category_id', 'name')
                    ->with('category:id,name');
            }])
            ->latest()
            ->paginate(20);

        $products = OutletInventory::where('outlet_id', $outlet->id)
            ->where('current_stock', '>', 0)
            ->with(['product' => function ($q) {
                $q->select('id', 'product_category_id', 'name', 'center_price')
                    ->with('category:id,name');
            }])
            ->get()
            ->map(fn ($inv) => [
                'id' => $inv->product->id,
                'name' => $inv->product->category?->name.' - '.$inv->product->name,
                'center_price' => (float) $inv->product->center_price,
                'stock' => $inv->current_stock,
            ]);

        return Inertia::render('outlet/offline-sales/index', [
            'sales' => $sales,
            'variants' => $products, // backward compat key
            'products' => $products,
        ]);
    }

    public function store(Request $request, SettlementGeneratorService $settlementGenerator): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $validated = $request->validate([
            'product_id' => ['sometimes', 'required', 'integer', 'exists:products,id'],
            'variant_id' => ['sometimes', 'required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:500'],
            'payment_method' => ['required', 'string', Rule::in(['cash', 'transfer', 'qris', 'other'])],
        ]);

        $productId = $validated['product_id'] ?? $validated['variant_id'];

        $product = Product::findOrFail($productId);
        $centerPrice = (float) $product->center_price;
        $totalAmount = $centerPrice * $validated['quantity'];

        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_id', $product->id)
            ->lockForUpdate()
            ->first();

        if (! $inventory || $inventory->current_stock < $validated['quantity']) {
            $available = $inventory?->current_stock ?? 0;
            throw ValidationException::withMessages([
                'quantity' => "Stok tidak mencukupi. Tersedia: {$available}",
            ]);
        }

        DB::transaction(function () use ($outlet, $product, $validated, $centerPrice, $totalAmount, $inventory, $request, $settlementGenerator) {
            $before = $inventory->current_stock;
            $inventory->decrement('current_stock', $validated['quantity']);

            OfflineSale::create([
                'outlet_id' => $outlet->id,
                'product_id' => $product->id,
                'quantity' => $validated['quantity'],
                'center_price' => $centerPrice,
                'total_amount' => $totalAmount,
                'payment_method' => $validated['payment_method'],
                'notes' => $validated['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            StockMovement::create([
                'outlet_id' => $outlet->id,
                'product_id' => $product->id,
                'type' => 'offline_sale',
                'quantity' => -$validated['quantity'],
                'before_stock' => $before,
                'after_stock' => $before - $validated['quantity'],
                'notes' => "Penjualan offline: {$validated['quantity']}x {$product->name}",
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
                'notes' => "Penjualan offline: {$validated['quantity']}x {$product->name}",
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

        DB::transaction(function () use ($outlet, $offlineSale, $settlementGenerator, $request) {
            // Reverse stock with lock
            $productId = $offlineSale->product_id;
            $inventory = OutletInventory::where('outlet_id', $outlet->id)
                ->where('product_id', $productId)
                ->lockForUpdate()
                ->first();

            if ($inventory) {
                $before = $inventory->current_stock;
                $inventory->increment('current_stock', $offlineSale->quantity);

                // Reversal StockMovement (keep original, add reversal)
                StockMovement::create([
                    'outlet_id' => $outlet->id,
                    'product_id' => $productId,
                    'type' => 'stock_adjustment',
                    'quantity' => $offlineSale->quantity,
                    'before_stock' => $before,
                    'after_stock' => $inventory->fresh()->current_stock,
                    'notes' => "Batal penjualan offline: {$offlineSale->quantity}x {$offlineSale->product?->name}",
                    'created_by' => $request->user()->id,
                ]);
            }

            // Reversal OutletPayable (keep original, add reversal entry)
            OutletPayable::create([
                'outlet_id' => $outlet->id,
                'type' => 'adjustment',
                'amount' => -$offlineSale->total_amount,
                'center_share' => -$offlineSale->total_amount,
                'outlet_margin' => 0,
                'due_date' => now()->endOfWeek(Carbon::SUNDAY)->addDays(7)->toDateString(),
                'paid_amount' => 0,
                'remaining_amount' => 0,
                'notes' => "Batal penjualan offline: {$offlineSale->quantity}x {$offlineSale->product?->name}",
                'created_by' => $request->user()->id,
            ]);

            // Delete the sale
            $offlineSale->delete();

            // Recalculate weekly settlement from remaining orders (source of truth)
            $settlementGenerator->recalculateForWeek($outlet, $offlineSale->created_at);
        });

        return back()->with('success', 'Penjualan offline berhasil dihapus.');
    }
}
