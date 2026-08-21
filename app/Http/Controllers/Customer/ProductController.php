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

    public function show(Request $request, ?ProductCategory $category = null): Response
    {
        // Resolve category from route param
        if (! $category) {
            $routeParam = $request->route('category');
            if ($routeParam instanceof ProductCategory) {
                $category = $routeParam;
            } elseif ($routeParam) {
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

        // Build family structure matching frontend Variant interface
        $products = $category->products->map(function ($product) use ($outletId) {
            $availableStock = 0;
            $minimumStock = 0;
            if ($product->relationLoaded('inventories')) {
                $availableStock = max(0, (int) $product->inventories->sum(
                    fn ($inv) => $inv->current_stock - $inv->reserved_stock
                ));
                $minimumStock = (int) $product->inventories->sum('minimum_stock');
            }

            $stockStatus = $availableStock <= 0
                ? 'out_of_stock'
                : ($minimumStock > 0 && $availableStock <= $minimumStock ? 'low' : 'available');

            $price = $outletId ? $product->priceForOutlet($outletId) : $product->selling_price;

            return [
                'id' => $product->id,
                'name' => $product->name,
                'flavor' => $product->flavor,
                'size' => $product->size,
                'selling_price' => $price,
                'is_active' => $product->is_active,
                'image' => $this->resolveImage($product->display_image),
                'available_stock' => $availableStock,
                'stock_status' => $stockStatus,
            ];
        })->values()->toArray();

        $family = [
            'id' => $category->id,
            'name' => $category->name,
            'description' => $category->description,
            'image' => null,
            'variants' => $products,
        ];

        // Other categories for cross-sell recommendations
        $otherCategories = ProductCategory::query()
            ->where('is_active', true)
            ->where('id', '!=', $category->id)
            ->with(['products' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('name')
            ->limit(4)
            ->get()
            ->map(fn ($cat) => [
                'id' => $cat->id,
                'name' => $cat->name,
                'variants' => $cat->products->map(fn ($p) => [
                    'selling_price' => $outletId ? $p->priceForOutlet($outletId) : $p->selling_price,
                ])->toArray(),
            ]);

        $isOpen = true;
        if ($outletId) {
            $outlet = Outlet::find($outletId);
            $isOpen = $outlet?->isOpen() ?? true;
        }

        return Inertia::render('customer/product-detail', [
            'family' => $family,
            'otherFamilies' => $otherCategories,
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
