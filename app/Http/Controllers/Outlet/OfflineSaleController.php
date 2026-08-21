<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OfflineSale;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\Product;
use App\Models\Settlement;
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

        $weekStart = $request->string('week_start')->toString();
        $weekEnd = $request->string('week_end')->toString();
        $period = $request->string('period', 'all')->toString();

        $salesQuery = OfflineSale::where('outlet_id', $outlet->id)
            ->when($weekStart, fn ($q) => $q->whereDate('created_at', '>=', $weekStart))
            ->when($weekEnd, fn ($q) => $q->whereDate('created_at', '<=', $weekEnd));

        // Period preset (minggu ini / bulan ini) — overrides week_start/week_end
        if ($period === 'week') {
            $salesQuery->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()]);
        } elseif ($period === 'month') {
            $salesQuery->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()]);
        }

        $sales = (clone $salesQuery)
            ->with(['product' => function ($q) {
                $q->select('id', 'product_category_id', 'name')
                    ->with('category:id,name');
            }])
            ->latest()
            ->paginate(20);

        // Group current page by date for structured display
        $groupedSales = $sales->getCollection()
            ->groupBy(fn ($s) => $s->created_at->toDateString())
            ->map(fn ($group) => [
                'date' => $group->first()->created_at->toDateString(),
                'total' => (float) $group->sum('total_amount'),
                'items' => $group->values(),
            ])
            ->values();

        $products = OutletInventory::where('outlet_id', $outlet->id)
            ->whereRaw('current_stock - reserved_stock > 0')
            ->with(['product' => function ($q) {
                $q->select('id', 'product_category_id', 'name', 'center_price')
                    ->with('category:id,name');
            }])
            ->get()
            ->map(fn ($inv) => [
                'id' => $inv->product->id,
                'name' => $inv->product->category?->name.' - '.$inv->product->name,
                'center_price' => (float) $inv->product->center_price,
                'stock' => $inv->current_stock - $inv->reserved_stock,
            ]);

        return Inertia::render('outlet/offline-sales/index', [
            'sales' => $sales,
            'groupedSales' => $groupedSales,
            'variants' => $products, // backward compat key
            'products' => $products,
            'weekStart' => $weekStart,
            'weekEnd' => $weekEnd,
            'period' => $period,
        ]);
    }

    public function show(Request $request, OfflineSale $offlineSale): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $offlineSale->outlet_id === $outlet->id, 403);

        $offlineSale->load(['product.category', 'creator']);

        // Settlement context for the sale's week — so outlet sees online vs offline split
        $weekStart = $offlineSale->created_at->copy()->startOfWeek()->toDateString();
        $weekEnd = $offlineSale->created_at->copy()->endOfWeek()->toDateString();
        $settlement = Settlement::where('outlet_id', $outlet->id)
            ->where('period_type', 'weekly')
            ->whereDate('period_start', $weekStart)
            ->first();

        return Inertia::render('outlet/offline-sales/show', [
            'week' => [
                'start' => $weekStart,
                'end' => $weekEnd,
                'online_share' => $settlement ? (float) $settlement->total_online_share : 0.0,
                'offline_total' => $settlement ? (float) $settlement->total_offline_sales : 0.0,
                'net_amount' => $settlement ? (float) $settlement->net_amount : 0.0,
                'direction' => $settlement?->direction ?? null,
            ],
            'sale' => [
                'id' => $offlineSale->id,
                'product_name' => $offlineSale->product?->category?->name
                    ? $offlineSale->product->category->name.' - '.$offlineSale->product->name
                    : $offlineSale->product?->name ?? '-',
                'quantity' => $offlineSale->quantity,
                'center_price' => (float) $offlineSale->center_price,
                'total_amount' => (float) $offlineSale->total_amount,
                'payment_method' => $offlineSale->payment_method,
                'notes' => $offlineSale->notes,
                'created_by' => $offlineSale->creator?->name,
                'created_at' => $offlineSale->created_at->toDateTimeString(),
            ],
            'outlet' => [
                'name' => $outlet->name,
            ],
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

        $availableStock = $inventory ? $inventory->current_stock - $inventory->reserved_stock : 0;

        if (! $inventory || $availableStock < $validated['quantity']) {
            throw ValidationException::withMessages([
                'quantity' => "Stok tidak mencukupi. Tersedia: {$availableStock}",
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

    public function update(Request $request, OfflineSale $offlineSale, SettlementGeneratorService $settlementGenerator): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $offlineSale->outlet_id === $outlet->id, 403);

        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:1'],
            'payment_method' => ['required', 'string', Rule::in(['cash', 'transfer', 'qris', 'other'])],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $product = $offlineSale->product;
        $centerPrice = (float) $offlineSale->center_price;
        $totalAmount = $centerPrice * $validated['quantity'];

        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_id', $offlineSale->product_id)
            ->lockForUpdate()
            ->first();

        // Reverse old quantity, then require new quantity against available stock
        $availableStock = $inventory
            ? $inventory->current_stock + $offlineSale->quantity - $inventory->reserved_stock
            : 0;

        if (! $inventory || $availableStock < $validated['quantity']) {
            throw ValidationException::withMessages([
                'quantity' => "Stok tidak mencukupi. Tersedia: {$availableStock}",
            ]);
        }

        DB::transaction(function () use ($outlet, $offlineSale, $inventory, $validated, $totalAmount, $request, $settlementGenerator) {
            $before = $inventory->current_stock;
            $delta = $validated['quantity'] - $offlineSale->quantity;
            $oldTotal = (float) $offlineSale->total_amount;
            $inventory->update(['current_stock' => $before - $delta]);

            $offlineSale->update([
                'quantity' => $validated['quantity'],
                'total_amount' => $totalAmount,
                'payment_method' => $validated['payment_method'],
                'notes' => $validated['notes'] ?? null,
            ]);

            if ($delta !== 0) {
                StockMovement::create([
                    'outlet_id' => $outlet->id,
                    'product_id' => $offlineSale->product_id,
                    'type' => 'stock_adjustment',
                    'quantity' => -$delta,
                    'before_stock' => $before,
                    'after_stock' => $before - $delta,
                    'notes' => "Ubah penjualan offline: {$offlineSale->quantity}x {$offlineSale->product?->name}",
                    'created_by' => $request->user()->id,
                ]);
            }

            // Reversal OutletPayable for old amount, re-add new amount
            OutletPayable::create([
                'outlet_id' => $outlet->id,
                'type' => 'adjustment',
                'amount' => -$oldTotal,
                'center_share' => -$oldTotal,
                'outlet_margin' => 0,
                'due_date' => now()->endOfWeek(Carbon::SUNDAY)->addDays(7)->toDateString(),
                'paid_amount' => 0,
                'remaining_amount' => 0,
                'notes' => "Batal ubah penjualan offline: {$offlineSale->quantity}x {$offlineSale->product?->name}",
                'created_by' => $request->user()->id,
            ]);
            OutletPayable::create([
                'outlet_id' => $outlet->id,
                'type' => 'sale',
                'amount' => $totalAmount,
                'center_share' => $totalAmount,
                'outlet_margin' => 0,
                'due_date' => now()->endOfWeek(Carbon::SUNDAY)->addDays(7)->toDateString(),
                'paid_amount' => 0,
                'remaining_amount' => $totalAmount,
                'notes' => "Penjualan offline: {$offlineSale->quantity}x {$offlineSale->product?->name}",
                'created_by' => $request->user()->id,
            ]);

            $settlementGenerator->recalculateForWeek($outlet, $offlineSale->created_at);
        });

        return back()->with('success', 'Penjualan offline berhasil diperbarui.');
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
