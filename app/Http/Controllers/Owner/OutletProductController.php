<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Services\OutletAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OutletProductController extends Controller
{
    /**
     * Get products assigned to this outlet (has inventory record).
     */
    public function index(Outlet $outlet): JsonResponse
    {
        $inventories = OutletInventory::where('outlet_id', $outlet->id)
            ->with('variant:id,name,flavor,size,selling_price,center_price,product_family_id')
            ->with('variant.family:id,name')
            ->get();

        $products = $inventories->map(fn ($inv) => [
            'id' => $inv->id,
            'variant_id' => $inv->product_variant_id,
            'name' => $inv->variant?->full_name ?? '-',
            'family_name' => $inv->variant?->family?->name ?? '-',
            'selling_price' => (float) ($inv->variant?->selling_price ?? 0),
            'is_active' => (bool) $inv->is_active,
            'current_stock' => (int) $inv->current_stock,
            'available_stock' => (int) $inv->current_stock - (int) $inv->reserved_stock,
            'stock_status' => $this->getStockStatus(
                (int) $inv->current_stock - (int) $inv->reserved_stock,
                (int) $inv->minimum_stock,
            ),
        ])->values();

        return response()->json($products);
    }

    /**
     * Get product variants NOT yet assigned to this outlet.
     * Used by the "Tambah Produk" modal.
     */
    public function availableProducts(Outlet $outlet): JsonResponse
    {
        $assignedIds = OutletInventory::where('outlet_id', $outlet->id)
            ->pluck('product_variant_id')
            ->toArray();

        $variants = ProductVariant::query()
            ->where('is_active', true)
            ->whereNotIn('id', $assignedIds)
            ->with('family:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'flavor', 'size', 'selling_price', 'product_family_id'])
            ->map(fn (ProductVariant $v) => [
                'variant_id' => $v->id,
                'name' => $v->full_name,
                'family_name' => $v->family?->name ?? '-',
                'selling_price' => (float) $v->selling_price,
            ]);

        return response()->json($variants);
    }

    /**
     * Add products to outlet with optional initial stock.
     */
    public function addProducts(Request $request, Outlet $outlet, OutletAuditService $auditService): JsonResponse
    {
        $validated = $request->validate([
            'variant_ids' => ['required', 'array', 'min:1'],
            'variant_ids.*' => ['integer'],
            'initial_stock' => ['nullable', 'integer', 'min:0'],
        ]);

        $initialStock = (int) ($validated['initial_stock'] ?? 0);
        $added = 0;

        foreach ($validated['variant_ids'] as $variantId) {
            $exists = OutletInventory::where('outlet_id', $outlet->id)
                ->where('product_variant_id', $variantId)
                ->exists();

            if ($exists) {
                continue;
            }

            OutletInventory::create([
                'outlet_id' => $outlet->id,
                'product_variant_id' => $variantId,
                'current_stock' => $initialStock,
                'reserved_stock' => 0,
                'minimum_stock' => 0,
                'is_active' => true,
            ]);
            $added++;
        }

        if ($added > 0) {
            $auditService->log(
                $outlet,
                'products_added',
                null,
                "{$added} produk ditambahkan (stok awal: {$initialStock})",
                $request->user(),
            );
        }

        return response()->json(['success' => true, 'added' => $added]);
    }

    /**
     * Toggle product active status.
     */
    public function toggle(Request $request, Outlet $outlet, int $variantId, OutletAuditService $auditService): JsonResponse
    {
        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_variant_id', $variantId)
            ->first();

        if (! $inventory) {
            return response()->json(['error' => 'Produk belum ditambahkan ke outlet.'], 404);
        }

        $oldStatus = $inventory->is_active;
        $inventory->update(['is_active' => ! $oldStatus]);

        $auditService->log(
            $outlet,
            'product_status',
            $oldStatus ? 'active' : 'inactive',
            $inventory->is_active ? 'active' : 'inactive',
            $request->user(),
        );

        return response()->json(['success' => true, 'is_active' => $inventory->is_active]);
    }

    /**
     * Remove product from outlet (soft — sets is_active=false).
     */
    public function remove(Request $request, Outlet $outlet, int $variantId, OutletAuditService $auditService): JsonResponse
    {
        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_variant_id', $variantId)
            ->first();

        if (! $inventory) {
            return response()->json(['error' => 'Produk tidak ditemukan.'], 404);
        }

        $inventory->update(['is_active' => false]);

        $auditService->log(
            $outlet,
            'product_removed',
            'active',
            'removed',
            $request->user(),
        );

        return response()->json(['success' => true]);
    }

    /**
     * Restock a product variant at an outlet.
     */
    public function restock(Request $request, Outlet $outlet, OutletAuditService $auditService): JsonResponse
    {
        $validated = $request->validate([
            'variant_id' => ['required', 'integer'],
            'quantity' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_variant_id', $validated['variant_id'])
            ->first();

        if (! $inventory) {
            return response()->json(['error' => 'Produk belum ditambahkan ke outlet.'], 404);
        }

        $oldStock = (int) $inventory->current_stock;
        $inventory->update(['current_stock' => $oldStock + $validated['quantity']]);

        $auditService->log(
            $outlet,
            'stock_restock',
            (string) $oldStock,
            (string) ($oldStock + $validated['quantity']),
            $request->user(),
        );

        return response()->json([
            'success' => true,
            'new_stock' => $inventory->current_stock,
        ]);
    }

    private function getStockStatus(int $available, int $minimum): string
    {
        if ($available <= 0) {
            return 'out_of_stock';
        }
        if ($minimum > 0 && $available < $minimum) {
            return 'low';
        }

        return 'ok';
    }
}
