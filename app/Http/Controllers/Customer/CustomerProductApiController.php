<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\ProductFamily;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerProductApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'outlet_id' => ['nullable', 'integer', 'exists:outlets,id'],
        ]);

        $outletId = $validated['outlet_id'] ?? null;

        $families = ProductFamily::query()
            ->where('is_active', true)
            ->with(['variants' => function ($query) use ($outletId) {
                $query->where('is_active', true)->orderBy('name');

                if ($outletId) {
                    $query->with(['inventories' => function ($inv) use ($outletId) {
                        $inv->where('outlet_id', $outletId)->where('is_active', true);
                    }]);
                    $query->with(['outletPrices' => function ($price) use ($outletId) {
                        $price->where('outlet_id', $outletId);
                    }]);
                }
            }])
            ->orderBy('name')
            ->get();

        $result = $families->map(function ($family) use ($outletId) {
            $variants = $family->variants->map(function ($variant) use ($outletId) {
                // Stock
                $availableStock = 0;
                $inventory = null;
                if ($outletId && $variant->relationLoaded('inventories')) {
                    $inventory = $variant->inventories->first();
                    $availableStock = max(0, (int) $variant->inventories->sum(
                        fn ($inv) => $inv->current_stock - $inv->reserved_stock
                    ));
                }

                // Price
                $price = $outletId ? $variant->priceForOutlet($outletId) : (float) $variant->selling_price;

                $stockStatus = $availableStock <= 0
                    ? 'out_of_stock'
                    : ($inventory && $availableStock <= ($inventory->minimum_stock ?? 0) ? 'low' : 'available');

                return [
                    'id' => $variant->id,
                    'name' => $variant->name,
                    'flavor' => $variant->flavor,
                    'size' => $variant->size,
                    'price' => $price,
                    'sku' => $variant->sku,
                    'available_stock' => $availableStock,
                    'stock_status' => $stockStatus,
                    'is_active' => $variant->is_active,
                ];
            });

            return [
                'id' => $family->id,
                'name' => $family->name,
                'brand' => $family->brand,
                'description' => $family->description,
                'variants' => $variants->values(),
            ];
        });

        return response()->json(['families' => $result]);
    }
}
