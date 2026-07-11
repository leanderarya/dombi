<?php

namespace App\Http\Controllers\Owner;

use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreInventoryRequest;
use App\Http\Requests\Owner\UpdateInventoryRequest;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
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
            ->with(['inventories' => fn ($q) => $q->with(['variant.family', 'product'])->orderBy('product_variant_id')])
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
            $variants = ProductVariant::where('is_active', true)
                ->with('family:id,name')
                ->orderBy('name')
                ->get()
                ->map(fn (ProductVariant $v) => [
                    'id' => $v->id,
                    'name' => $v->full_name,
                    'family_name' => $v->family?->name,
                    'sku' => $v->sku,
                    'center_stock' => $v->center_stock,
                    'center_price' => (float) $v->center_price,
                ]);

            $data['centralStock'] = $variants;
            $data['centralStats'] = [
                'total_variants' => $variants->count(),
                'total_stock' => $variants->sum('center_stock'),
                'zero_stock' => $variants->filter(fn ($v) => $v['center_stock'] <= 0)->count(),
                'low_stock' => $variants->filter(fn ($v) => $v['center_stock'] > 0 && $v['center_stock'] <= 10)->count(),
            ];
        }

        return Inertia::render('owner/inventories/index', $data);
    }

    public function create(): Response
    {
        $families = ProductFamily::where('is_active', true)
            ->with(['variants' => fn ($q) => $q->where('is_active', true)->orderBy('name')])
            ->orderBy('name')
            ->get();

        return Inertia::render('owner/inventories/create', [
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'families' => $families,
        ]);
    }

    /**
     * Update center stock for a variant (quick edit from Stok Pusat tab).
     */
    public function updateCenterStock(Request $request, ProductVariant $variant): RedirectResponse
    {
        $validated = $request->validate([
            'center_stock' => ['required', 'integer', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        app(InventoryService::class)->updateCenterStock(
            $variant->id,
            $validated['center_stock'],
            $validated['reason'] ?? null,
        );

        return back()->with('success', "Stok pusat {$variant->full_name} berhasil diperbarui.");
    }

    public function store(StoreInventoryRequest $request, InventoryService $inventoryService): RedirectResponse
    {
        $data = $request->validated();

        try {
            DB::transaction(function () use ($data, $inventoryService): void {
                $variant = ProductVariant::findOrFail($data['product_variant_id']);

                $inventory = OutletInventory::updateOrCreate(
                    ['outlet_id' => $data['outlet_id'], 'product_variant_id' => $data['product_variant_id']],
                    ['product_id' => $variant->product_id, 'minimum_stock' => $data['minimum_stock']]
                );

                $inventoryService->adjustStock($inventory->outlet_id, (int) $data['product_variant_id'], (int) $data['current_stock'], $data['notes'] ?? null);
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
            'inventory' => $inventory->load(['outlet', 'variant.family', 'product']),
        ]);
    }

    public function update(UpdateInventoryRequest $request, OutletInventory $inventory, InventoryService $inventoryService): RedirectResponse
    {
        $data = $request->validated();

        try {
            DB::transaction(function () use ($data, $inventory, $inventoryService): void {
                $variantId = $inventory->product_variant_id;
                $inventoryService->adjustStock($inventory->outlet_id, (int) $variantId, (int) $data['current_stock'], $data['notes'] ?? null);
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
            'product_variant_id' => ['required', 'exists:product_variants,id'],
        ]);

        $inventory = OutletInventory::where('outlet_id', $validated['outlet_id'])
            ->where('product_variant_id', $validated['product_variant_id'])
            ->first();

        if (! $inventory) {
            return response()->json(['message' => 'Item tidak ditemukan.'], 404);
        }

        $variant = ProductVariant::find($validated['product_variant_id']);
        $productName = $variant->full_name ?? 'Produk';
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
