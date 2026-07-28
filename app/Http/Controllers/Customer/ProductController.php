<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\ProductCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('customer/products');
    }

    public function show(Request $request, ProductCategory $category = null): Response
    {
        // Resolve category from either 'category' (new) or 'family' (legacy) route param
        if (! $category) {
            $routeParam = $request->route('category') ?? $request->route('family');
            if ($routeParam instanceof ProductCategory) {
                $category = $routeParam;
            } elseif ($routeParam) {
                // Could be ProductFamily model instance or id – convert to ProductCategory
                $id = is_object($routeParam) ? $routeParam->id : $routeParam;
                $category = ProductCategory::findOrFail($id);
            } else {
                abort(404);
            }
        }

        $outletId = $request->integer('outlet_id') ?: null;

        $category->load([
            'products' => function ($query) use ($outletId) {
                $query->where('is_active', true)
                    ->orderBy('name');

                if ($outletId) {
                    $query->with(['inventories' => function ($inv) use ($outletId) {
                        $inv->where('outlet_id', $outletId)->where('is_active', true);
                    }]);
                    $query->with(['outletPrices' => function ($price) use ($outletId) {
                        $price->where('outlet_id', $outletId);
                    }]);
                } else {
                    $query->with('inventories');
                }
            },
        ]);

        // Resolve image URLs for Inertia serialization
        $category->image = $this->resolveImage($category->image);
        $category->products->each(function ($product) {
            $product->image = $this->resolveImage($product->image);
        });

        // Compute stock status and outlet price for each product
        $category->products->each(function ($product) use ($outletId) {
            $availableStock = 0;
            $minimumStock = 0;
            if ($product->relationLoaded('inventories')) {
                $availableStock = max(0, (int) $product->inventories->sum(
                    fn ($inv) => $inv->current_stock - $inv->reserved_stock
                ));
                $minimumStock = (int) $product->inventories->sum('minimum_stock');
            }

            $product->available_stock = $availableStock;
            $product->stock_status = $availableStock <= 0
                ? 'out_of_stock'
                : ($minimumStock > 0 && $availableStock <= $minimumStock ? 'low' : 'available');

            // Override selling_price with outlet-specific price if available
            if ($outletId) {
                $outletPrice = $product->priceForOutlet($outletId);
                $product->selling_price = $outletPrice;
            }
        });

        // Other categories for cross-sell recommendations
        $otherCategories = ProductCategory::query()
            ->where('is_active', true)
            ->where('id', '!=', $category->id)
            ->with(['products' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('name')
            ->limit(4)
            ->get();

        $isOpen = true;
        if ($outletId) {
            $outlet = Outlet::find($outletId);
            $isOpen = $outlet?->isOpen() ?? true;
        }

        return Inertia::render('customer/product-detail', [
            'family' => $category, // backward compat key
            'category' => $category,
            'otherFamilies' => $otherCategories, // backward compat
            'otherCategories' => $otherCategories,
            'outletId' => $outletId,
            'is_open' => $isOpen,
        ]);
    }

    private function resolveImage(?string $image): ?string
    {
        if (! $image) {
            return null;
        }

        if (str_starts_with($image, 'http://') || str_starts_with($image, 'https://')) {
            return $image;
        }

        return asset("storage/{$image}");
    }
}
