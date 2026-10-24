<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OfflineSale;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\Product;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Models\StockMovement;
use App\Services\PricingService;
use App\Services\SettlementGeneratorService;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OfflineSaleController extends Controller
{
    public function index(Request $request, PricingService $pricingService): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $weekStart = $request->string('week_start')->toString();
        $weekEnd = $request->string('week_end')->toString();
        $period = $request->string('period', 'all')->toString();

        $salesQuery = OfflineSale::where('outlet_id', $outlet->id)
            ->when($weekStart, fn ($q) => $q->whereFromDay('created_at', $weekStart))
            ->when($weekEnd, fn ($q) => $q->whereUntilDay('created_at', $weekEnd));

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

        $groupedSales = $sales->getCollection()
            ->groupBy(fn ($s) => $s->created_at->toDateString())
            ->map(fn ($group) => [
                'date' => $group->first()->created_at->toDateString(),
                'total' => (float) $group->sum('total_amount'),
                'items' => $group->values(),
            ])
            ->values();

        $products = OutletInventory::where('outlet_id', $outlet->id)
            ->whereInStock()
            ->with(['product' => function ($q) {
                $q->select('id', 'product_category_id', 'name', 'center_price', 'selling_price')
                    ->with('category:id,name');
            }])
            ->get()
            ->map(fn ($inv) => [
                'id' => $inv->product->id,
                'name' => $inv->product->category?->name.' - '.$inv->product->name,
                'center_price' => (float) $inv->product->center_price,
                'selling_price' => $pricingService->getSellingPrice($inv->product, $outlet->id),
                'stock' => $inv->current_stock - $inv->reserved_stock,
            ]);

        return Inertia::render('outlet/offline-sales/index', [
            'sales' => $sales,
            'groupedSales' => $groupedSales,
            'variants' => $products,
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
        $weekStart = $offlineSale->created_at->copy()->startOfWeek()->toDateString();
        $weekEnd = $offlineSale->created_at->copy()->endOfWeek()->toDateString();
        $settlement = Settlement::where('outlet_id', $outlet->id)
            ->where('period_type', 'weekly')
            ->whereOnDay('period_start', $weekStart)
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
                'selling_price_snapshot' => $offlineSale->selling_price_snapshot !== null
                    ? (float) $offlineSale->selling_price_snapshot
                    : null,
                'gross_amount' => $offlineSale->gross_amount !== null
                    ? (float) $offlineSale->gross_amount
                    : null,
                'total_amount' => (float) $offlineSale->total_amount,
                'payment_method' => $offlineSale->payment_method,
                'notes' => $offlineSale->notes,
                'created_by' => $offlineSale->creator?->name,
                'created_at' => $offlineSale->created_at->toDateTimeString(),
            ],
            'outlet' => ['name' => $outlet->name],
        ]);
    }

    public function store(
        Request $request,
        PricingService $pricingService,
        SettlementGeneratorService $settlementGenerator,
    ): RedirectResponse {
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

        DB::transaction(function () use ($outlet, $productId, $validated, $request, $pricingService, $settlementGenerator) {
            Outlet::lockForSettlement($outlet->id);
            $product = Product::findOrFail($productId);
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

            $quantity = $validated['quantity'];
            $centerPrice = (float) $product->center_price;
            $sellingPrice = $pricingService->getSellingPrice($product, $outlet->id);
            $centerShare = $centerPrice * $quantity;
            $grossAmount = $sellingPrice * $quantity;
            $outletMargin = $grossAmount - $centerShare;
            $before = $inventory->current_stock;
            $inventory->decrement('current_stock', $quantity);

            $sale = OfflineSale::create([
                'outlet_id' => $outlet->id,
                'product_id' => $product->id,
                'quantity' => $quantity,
                'center_price' => $centerPrice,
                'selling_price_snapshot' => $sellingPrice,
                'gross_amount' => $grossAmount,
                'total_amount' => $centerShare,
                'payment_method' => $validated['payment_method'],
                'notes' => $validated['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            StockMovement::create([
                'outlet_id' => $outlet->id,
                'product_id' => $product->id,
                'type' => 'offline_sale',
                'quantity' => -$quantity,
                'before_stock' => $before,
                'after_stock' => $before - $quantity,
                'reference_type' => OfflineSale::class,
                'reference_id' => $sale->id,
                'notes' => "Penjualan offline: {$quantity}x {$product->name}",
                'created_by' => $request->user()->id,
            ]);

            OutletPayable::create([
                'outlet_id' => $outlet->id,
                'type' => 'sale',
                'amount' => $centerShare,
                'center_share' => $centerShare,
                'outlet_margin' => $outletMargin,
                'reference_type' => OfflineSale::class,
                'reference_id' => $sale->id,
                'due_date' => now()->endOfWeek(Carbon::SUNDAY)->addDays(7)->toDateString(),
                'paid_amount' => 0,
                'remaining_amount' => $centerShare,
                'notes' => "Penjualan offline: {$quantity}x {$product->name}",
                'created_by' => $request->user()->id,
            ]);

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

        DB::transaction(function () use ($outlet, $offlineSale, $validated, $request, $settlementGenerator) {
            Outlet::lockForSettlement($outlet->id);
            $sale = OfflineSale::whereKey($offlineSale->id)->lockForUpdate()->firstOrFail();
            abort_unless($sale->outlet_id === $outlet->id, 403);
            $this->assertWeekHasNoPayments($outlet->id, $sale->created_at);
            if ($sale->selling_price_snapshot === null) {
                throw ValidationException::withMessages([
                    'quantity' => 'Penjualan historis tidak dapat diubah karena snapshot harga jual tidak tersedia.',
                ]);
            }

            $inventory = OutletInventory::where('outlet_id', $outlet->id)
                ->where('product_id', $sale->product_id)
                ->lockForUpdate()
                ->first();
            $availableStock = $inventory
                ? $inventory->current_stock + $sale->quantity - $inventory->reserved_stock
                : 0;

            if (! $inventory || $availableStock < $validated['quantity']) {
                throw ValidationException::withMessages([
                    'quantity' => "Stok tidak mencukupi. Tersedia: {$availableStock}",
                ]);
            }

            $product = Product::findOrFail($sale->product_id);
            $quantity = $validated['quantity'];
            $delta = $quantity - $sale->quantity;
            $centerShare = (float) $sale->center_price * $quantity;
            $sellingPrice = $sale->selling_price_snapshot;
            $grossAmount = $sellingPrice !== null ? (float) $sellingPrice * $quantity : null;
            $outletMargin = $grossAmount !== null ? $grossAmount - $centerShare : null;
            $before = $inventory->current_stock;
            $oldTotal = (float) $sale->total_amount;
            $inventory->update(['current_stock' => $before - $delta]);

            $sale->update([
                'quantity' => $quantity,
                'gross_amount' => $grossAmount,
                'total_amount' => $centerShare,
                'payment_method' => $validated['payment_method'],
                'notes' => $validated['notes'] ?? null,
            ]);

            if ($delta !== 0) {
                StockMovement::create([
                    'outlet_id' => $outlet->id,
                    'product_id' => $sale->product_id,
                    'type' => 'stock_adjustment',
                    'quantity' => -$delta,
                    'before_stock' => $before,
                    'after_stock' => $before - $delta,
                    'reference_type' => OfflineSale::class,
                    'reference_id' => $sale->id,
                    'notes' => "Ubah penjualan offline: {$quantity}x {$product->name}",
                    'created_by' => $request->user()->id,
                ]);
            }

            OutletPayable::create([
                'outlet_id' => $outlet->id,
                'type' => 'adjustment',
                'amount' => -$oldTotal,
                'center_share' => -$oldTotal,
                'outlet_margin' => 0,
                'reference_type' => OfflineSale::class,
                'reference_id' => $sale->id,
                'due_date' => now()->endOfWeek(Carbon::SUNDAY)->addDays(7)->toDateString(),
                'paid_amount' => 0,
                'remaining_amount' => 0,
                'notes' => "Batal ubah penjualan offline: {$sale->quantity}x {$product->name}",
                'created_by' => $request->user()->id,
            ]);
            OutletPayable::create([
                'outlet_id' => $outlet->id,
                'type' => 'sale',
                'amount' => $centerShare,
                'center_share' => $centerShare,
                'outlet_margin' => $outletMargin ?? 0,
                'reference_type' => OfflineSale::class,
                'reference_id' => $sale->id,
                'due_date' => now()->endOfWeek(Carbon::SUNDAY)->addDays(7)->toDateString(),
                'paid_amount' => 0,
                'remaining_amount' => $centerShare,
                'notes' => "Penjualan offline: {$quantity}x {$product->name}",
                'created_by' => $request->user()->id,
            ]);

            $settlementGenerator->recalculateForWeek($outlet, $sale->created_at);
        });

        return back()->with('success', 'Penjualan offline berhasil diperbarui.');
    }

    private function assertWeekHasNoPayments(int $outletId, CarbonInterface $createdAt): void
    {
        $weekStart = $createdAt->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
        $weekEnd = $createdAt->copy()->endOfWeek(Carbon::SUNDAY)->toDateString();
        $settlement = Settlement::where('outlet_id', $outletId)
            ->where('period_type', 'weekly')
            ->whereDate('period_start', $weekStart)
            ->lockForUpdate()
            ->first();

        if (! $settlement) {
            return;
        }

        $hasPayments = SettlementPayment::where('settlement_id', $settlement->id)
            ->whereIn('status', [SettlementPayment::STATUS_PENDING, SettlementPayment::STATUS_VERIFIED])
            ->exists();

        if ($settlement->isPaid() || (float) $settlement->paid_amount > 0 || $hasPayments) {
            throw ValidationException::withMessages([
                'quantity' => "Penjualan pada pekan {$weekStart}–{$weekEnd} tidak dapat diubah karena settlement sudah memiliki pembayaran.",
            ]);
        }
    }

    public function destroy(Request $request, OfflineSale $offlineSale, SettlementGeneratorService $settlementGenerator): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet && $offlineSale->outlet_id === $outlet->id, 403);

        DB::transaction(function () use ($outlet, $offlineSale, $settlementGenerator, $request) {
            Outlet::lockForSettlement($outlet->id);
            $sale = OfflineSale::whereKey($offlineSale->id)->lockForUpdate()->firstOrFail();
            abort_unless($sale->outlet_id === $outlet->id, 403);
            $this->assertWeekHasNoPayments($outlet->id, $sale->created_at);

            $inventory = OutletInventory::where('outlet_id', $outlet->id)
                ->where('product_id', $sale->product_id)
                ->lockForUpdate()
                ->first();
            if (! $inventory) {
                throw ValidationException::withMessages([
                    'quantity' => 'Stok outlet tidak tersedia; penjualan tidak dihapus.',
                ]);
            }

            $product = Product::findOrFail($sale->product_id);
            $before = $inventory->current_stock;
            $after = $before + $sale->quantity;
            $inventory->update(['current_stock' => $after]);

            StockMovement::create([
                'outlet_id' => $outlet->id,
                'product_id' => $sale->product_id,
                'type' => 'stock_adjustment',
                'quantity' => $sale->quantity,
                'before_stock' => $before,
                'after_stock' => $after,
                'reference_type' => OfflineSale::class,
                'reference_id' => $sale->id,
                'notes' => "Batal penjualan offline: {$sale->quantity}x {$product->name}",
                'created_by' => $request->user()->id,
            ]);

            OutletPayable::create([
                'outlet_id' => $outlet->id,
                'type' => 'adjustment',
                'amount' => -$sale->total_amount,
                'center_share' => -$sale->total_amount,
                'outlet_margin' => 0,
                'reference_type' => OfflineSale::class,
                'reference_id' => $sale->id,
                'due_date' => now()->endOfWeek(Carbon::SUNDAY)->addDays(7)->toDateString(),
                'paid_amount' => 0,
                'remaining_amount' => 0,
                'notes' => "Batal penjualan offline: {$sale->quantity}x {$product->name}",
                'created_by' => $request->user()->id,
            ]);

            $date = $sale->created_at;
            $sale->delete();
            $settlementGenerator->recalculateForWeek($outlet, $date);
        });

        return back()->with('success', 'Penjualan offline berhasil dihapus.');
    }
}
