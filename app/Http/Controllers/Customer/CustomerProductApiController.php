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
                // Calculate outlet-specific stock
                $availableStock = 0;
                if ($outletId && $variant->relationLoaded('inventories')) {
                    $availableStock = (int) $variant->inventories->sum(
                        fn ($inv) => $inv->current_stock - $inv->reserved_stock
                    );
                } elseif (!$outletId && $variant->relationLoaded('inventories')) {
                    // No outlet: sum across all outlets
                    $availableStock = (int) $variant->inventories->sum(
                        fn ($inv) => $inv->current_stock - $inv->reserved_stock
                    );
                }

                // Calculate outlet-specific price
                $price = (float) $variant->selling_price;
                if ($outletId && $variant->relationLoaded('outletPrices')) {
                    $override = $variant->outletPrices->first();
                    if ($override) {
                        $price = (float) $override->selling_price;
                    }
                }

                return [
                    'id' => $variant->id,
                    'name' => $variant->name,
                    'flavor' => $variant->flavor,
                    'size' => $variant->size,
                    'price' => $price,
                    'sku' => $variant->sku,
                    'available_stock' => $availableStock,
                    'is_active' => $variant->is_active,
                ];
            });

            return [
                'id' => $family->id,
                'name' => $family->name,
                'brand' => $family->brand,
                'description' => $family->description,
                'image_url' => $family->image,
                'variants' => $variants->values(),
            ];
        });

        return response()->json(['families' => $result]);
    }
}
