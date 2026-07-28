<?php

namespace App\Http\Controllers\Owner;

use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreInventoryRequest;
use App\Http\Requests\Owner\UpdateInventoryRequest;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Services\InventoryService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = $request->string('tab', 'outlet')->toString();

        $data = ['tab' => $tab];

        // Outlet inventory (always loaded)
        $outlets = Outlet::where('status', 'active')
            ->with(['inventories' => fn ($q) => $q->with(['product.category'])->orderBy('product_id')])
            ->orderBy('name')
            ->get();

        $outletSections = $outlets->map(function ($outlet) {
            $inventories = $outlet->inventories;
            $totalSku = $inventories->count();
            $lowStock = $inventories->filter(fn ($i) => ($i->current_stock - $i->reserved_stock) <= $i->minimum_stock)->count();
            $critical = $inventories->filter(fn ($i) => ($i->current_stock - $i->reserved_stock) <= 0)->count();
            $totalReserved = $inventories->sum('reserved_stock');
            $health = $critical > 0 ? 'critical' : ($lowStock > 0 ? 'low_stock' : 'healthy');

            return [
                'outlet' => ['id' => $outlet->id, 'name' => $outlet->name],
                'health' => $health,
                'totalSku' => $totalSku,
                'lowStock' => $lowStock,
                'critical' => $critical,
                'totalReserved' => $totalReserved,
                'inventories' => $inventories,
            ];
        });

        $data['outletSections'] = $outletSections;
        $data['stats'] = [
            'totalSku' => OutletInventory::count(),
            'lowStock' => OutletInventory::whereRaw('(current_stock - reserved_stock) <= minimum_stock')->count(),
            'totalReserved' => (int) OutletInventory::sum('reserved_stock'),
            'critical' => OutletInventory::whereRaw('(current_stock - reserved_stock) <= 0')->count(),
        ];

        // Central stock (loaded when tab is pusat)
        if ($tab === 'pusat') {
            $products = Product::where('is_active', true)
                ->with('category:id,name')
                ->orderBy('name')
                ->get()
                ->map(fn (Product $p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'category_name' => $p->category?->name,
                    'family_name' => $p->category?->name, // backward compat
                    'sku' => $p->sku,
                    'center_stock' => $p->center_stock,
                    'center_price' => (float) $p->center_price,
                ]);

            $data['centralStock'] = $products;
            $data['centralStats'] = [
                'total_variants' => $products->count(),
                'total_products' => $products->count(),
                'total_stock' => $products->sum('center_stock'),
                'zero_stock' => $products->filter(fn ($v) => $v['center_stock'] <= 0)->count(),
                'low_stock' => $products->filter(fn ($v) => $v['center_stock'] > 0 && $v['center_stock'] <= 10)->count(),
            ];
        }

        return Inertia::render('owner/inventories/index', $data);
    }

    public function create(): Response
    {
        $categories = ProductCategory::where('is_active', true)
            ->with(['products' => fn ($q) => $q->where('is_active', true)->orderBy('name')])
            ->orderBy('name')
            ->get();

        return Inertia::render('owner/inventories/create', [
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'families' => $categories, // backward compat for old frontend
            'categories' => $categories,
        ]);
    }

    /**
     * Update center stock for a product (quick edit from Stok Pusat tab).
     */
    public function updateCenterStock(Request $request, Product $product = null): RedirectResponse
    {
        if (! $product) {
            $routeVal = $request->route('variant') ?? $request->route('product');
            $id = is_object($routeVal) ? $routeVal->id : $routeVal;
            $product = Product::findOrFail($id);
        }

        $validated = $request->validate([
            'center_stock' => ['required', 'integer', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        app(InventoryService::class)->updateCenterStock(
            $product->id,
            $validated['center_stock'],
            $validated['reason'] ?? null,
        );

        return back()->with('success', "Stok pusat {$product->name} berhasil diperbarui.");
    }

    public function store(StoreInventoryRequest $request, InventoryService $inventoryService): RedirectResponse
    {
        $data = $request->validated();
        $productId = $data['product_id'] ?? null;
        $data['product_id'] = $productId;

        try {
            DB::transaction(function () use ($data, $inventoryService): void {
                $product = Product::findOrFail($data['product_id']);

                $inventory = OutletInventory::updateOrCreate(
                    ['outlet_id' => $data['outlet_id'], 'product_id' => $data['product_id']],
                    ['minimum_stock' => $data['minimum_stock']]
                );

                $inventoryService->adjustStock($inventory->outlet_id, (int) $data['product_id'], (int) $data['current_stock'], $data['notes'] ?? null);
                $inventory->update(['minimum_stock' => $data['minimum_stock']]);
            });
        } catch (InsufficientStockException $e) {
            return redirect()->back()->withErrors(['current_stock' => 'Stok tidak boleh lebih rendah dari reserved stock.'])->withInput();
        }

        return redirect()->route('owner.inventories.index')->with('success', 'Inventory berhasil disimpan.');
    }

    public function edit(OutletInventory $inventory): Response
    {
        return Inertia::render('owner/inventories/edit', [
            'inventory' => $inventory->load(['outlet', 'product.category']),
        ]);
    }

    public function update(UpdateInventoryRequest $request, OutletInventory $inventory, InventoryService $inventoryService): RedirectResponse
    {
        $data = $request->validated();

        try {
            DB::transaction(function () use ($data, $inventory, $inventoryService): void {
                $productId = $inventory->product_id;
                $inventoryService->adjustStock($inventory->outlet_id, (int) $productId, (int) $data['current_stock'], $data['notes'] ?? null);
                $inventory->update(['minimum_stock' => $data['minimum_stock']]);
            });
        } catch (InsufficientStockException $e) {
            return redirect()->back()->withErrors(['current_stock' => 'Stok tidak boleh lebih rendah dari reserved stock.'])->withInput();
        }

        return redirect()->route('owner.inventories.index')->with('success', 'Inventory berhasil diperbarui.');
    }

    /**
     * Send low/critical stock reminder notification to outlet.
     */
    public function remindStock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'outlet_id' => ['required', 'exists:outlets,id'],
            'product_id' => ['required', 'exists:products,id'],
        ]);

        $productId = $validated['product_id'];

        $inventory = OutletInventory::where('outlet_id', $validated['outlet_id'])
            ->where('product_id', $productId)
            ->first();

        if (! $inventory) {
            return response()->json(['message' => 'Item tidak ditemukan.'], 404);
        }

        $product = Product::find($productId);
        $productName = $product->name ?? $product->full_display_name ?? 'Produk';
        $available = max(0, $inventory->current_stock - $inventory->reserved_stock);

        app(NotificationService::class)->notifyLowStock(
            outletId: $validated['outlet_id'],
            productName: $productName,
            available: $available,
            minimum: $inventory->minimum_stock,
        );

        return response()->json(['message' => 'Pengingat stok dikirim ke outlet.']);
    }
}
