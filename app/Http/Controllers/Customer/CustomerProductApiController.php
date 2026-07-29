<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\ProductCategory;
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

        $categories = ProductCategory::query()
            ->where('is_active', true)
            ->with(['products' => function ($query) use ($outletId) {
                $query->where('is_active', true)->orderBy('name');

                if ($outletId) {
                    $query->with(['inventories' => function ($inv) use ($outletId) {
                        $inv->where('outlet_id', $outletId)->where('is_active', true);
                    }]);
                    $query->with(['outletPrices' => function ($price) use ($outletId) {
                        $price->where('outlet_id', $outletId);
                    }]);
                }

                $query->with('flavorGroup');
            }])
            ->orderBy('name')
            ->get();

        $result = $categories->map(function ($category) use ($outletId) {
            $products = $category->products->map(function ($product) use ($outletId) {
                // Stock
                $availableStock = 0;
                $inventory = null;
                if ($outletId && $product->relationLoaded('inventories')) {
                    $inventory = $product->inventories->first();
                    $availableStock = max(0, (int) $product->inventories->sum(
                        fn ($inv) => $inv->current_stock - $inv->reserved_stock
                    ));
                }

                // Price
                $price = $outletId ? $product->priceForOutlet($outletId) : (float) $product->selling_price;

                $stockStatus = $availableStock <= 0
                    ? 'out_of_stock'
                    : ($inventory && $availableStock <= ($inventory->minimum_stock ?? 0) ? 'low' : 'available');

                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'flavor' => $product->flavor,
                    'size' => $product->size,
                    'price' => $price,
                    'sku' => $product->sku,
                    'image' => $this->resolveImage($product->display_image, $product->updated_at),
                    'image_owner' => $product->display_image
                        ? ($product->product_flavor_group_id ? 'flavor_group' : 'product')
                        : 'none',
                    'image_owner_id' => $product->display_image
                        ? ($product->product_flavor_group_id ? $product->product_flavor_group_id : $product->id)
                        : null,
                    'has_image' => $product->display_image !== null,
                    'available_stock' => $availableStock,
                    'stock_status' => $stockStatus,
                    'is_active' => $product->is_active,
                ];
            });

            return [
                'id' => $category->id,
                'name' => $category->name,
                'description' => $category->description,
                'variants' => $products->values(), // backward compat key
                'products' => $products->values(),
            ];
        });

        return response()->json(['families' => $result, 'categories' => $result]);
    }

    private function resolveImage(?string $image, $updatedAt): ?string
    {
        if (! $image) {
            return null;
        }

        $separator = str_contains($image, '?') ? '&' : '?';

        // Already a full URL (external image) — return as-is with cache-busting
        if (str_starts_with($image, 'http://') || str_starts_with($image, 'https://')) {
            return $image.$separator.'v='.$updatedAt->timestamp;
        }

        // Local storage path — generate full URL
        return asset("storage/{$image}").$separator.'v='.$updatedAt->timestamp;
    }
}
