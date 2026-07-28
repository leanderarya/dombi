<?php

namespace App\Http\Controllers\Owner;

use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Services\InventoryService;
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
            ->with('product:id,name,flavor,size,selling_price,center_price,product_category_id')
            ->with('product.category:id,name')
            ->get();

        $products = $inventories->map(fn ($inv) => [
            'id' => $inv->id,
            'product_id' => $inv->product_id,
            'variant_id' => $inv->product_id, // backward compat
            'name' => $inv->product?->name ?? '-',
            'category_name' => $inv->product?->category?->name ?? '-',
            'family_name' => $inv->product?->category?->name ?? '-', // backward compat
            'selling_price' => (float) ($inv->product?->selling_price ?? 0),
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
            ->pluck('product_id')
            ->toArray();

        $products = Product::query()
            ->where('is_active', true)
            ->whereNotIn('id', $assignedIds)
            ->with('category:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'flavor', 'size', 'selling_price', 'product_category_id'])
            ->map(fn (Product $p) => [
                'product_id' => $p->id,
                'variant_id' => $p->id, // backward compat
                'name' => $p->name,
                'category_name' => $p->category?->name ?? '-',
                'family_name' => $p->category?->name ?? '-',
                'selling_price' => (float) $p->selling_price,
            ]);

        return response()->json($products);
    }

    /**
     * Add products to outlet with optional initial stock.
     */
    public function addProducts(Request $request, Outlet $outlet, OutletAuditService $auditService): JsonResponse
    {
        $validated = $request->validate([
            'product_ids' => ['sometimes', 'array', 'min:1'],
            'variant_ids' => ['sometimes', 'array', 'min:1'],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'variant_ids.*' => ['integer', 'exists:products,id'],
            'initial_stock' => ['nullable', 'integer', 'min:0'],
        ]);

        // Backward compat: support variant_ids param
        $productIds = $validated['product_ids'] ?? $validated['variant_ids'] ?? [];
        // Also support legacy key 'variant_ids' directly in request without being validated via product_ids
        if (empty($productIds) && $request->has('variant_ids')) {
            $productIds = $request->input('variant_ids');
        }
        // Support also 'product_ids' legacy spelled? Already handled
        // Also handle raw 'variant_ids' that might be sent as 'product_ids'? covered

        $initialStock = (int) ($validated['initial_stock'] ?? 0);
        $added = 0;

        foreach ($productIds as $productId) {
            $exists = OutletInventory::where('outlet_id', $outlet->id)
                ->where('product_id', $productId)
                ->exists();

            if ($exists) {
                continue;
            }

            OutletInventory::create([
                'outlet_id' => $outlet->id,
                'product_id' => $productId,
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
    public function toggle(Request $request, Outlet $outlet, OutletAuditService $auditService): JsonResponse
    {
        $routeProduct = $request->route('product');
        $routeProductId = $routeProduct instanceof Product ? $routeProduct->id : $routeProduct;
        $productId = (int) ($routeProductId ?? $request->route('productId') ?? $request->route('variantId') ?? $request->route('product_id') ?? $request->route('variant_id') ?? 0);

        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_id', $productId)
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
    public function remove(Request $request, Outlet $outlet, OutletAuditService $auditService): JsonResponse
    {
        $routeProduct = $request->route('product');
        $routeProductId = $routeProduct instanceof Product ? $routeProduct->id : $routeProduct;
        $productId = (int) ($routeProductId ?? $request->route('productId') ?? $request->route('variantId') ?? $request->route('product_id') ?? $request->route('variant_id') ?? 0);

        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_id', $productId)
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
    public function restock(Request $request, Outlet $outlet): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['sometimes', 'required', 'integer', 'exists:products,id'],
            'variant_id' => ['sometimes', 'required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $productId = $validated['product_id'] ?? $validated['variant_id'] ?? null;

        try {
            app(InventoryService::class)->restockOutlet(
                $outlet->id,
                $productId,
                $validated['quantity'],
                $validated['notes'] ?? null,
            );

            $inventory = OutletInventory::where('outlet_id', $outlet->id)
                ->where('product_id', $productId)
                ->first();

            return response()->json([
                'success' => true,
                'new_stock' => $inventory?->current_stock ?? 0,
            ]);
        } catch (InsufficientStockException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['error' => 'Gagal melakukan restock.'], 500);
        }
    }

    public function bulkAssign(Request $request, Outlet $outlet, OutletAuditService $auditService): JsonResponse
    {
        return $this->addProducts($request, $outlet, $auditService);
    }

    private function getStockStatus(int $available, int $minimum): string
    {
        if ($available <= 0) {
            return 'out_of_stock';
        }
        if ($minimum > 0 && $available < $minimum) {
            return 'low';
        }

        return 'available';
    }
}
