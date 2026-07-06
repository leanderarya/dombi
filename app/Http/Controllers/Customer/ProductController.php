<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\ProductFamily;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('customer/products');
    }

    public function show(Request $request, ProductFamily $family): Response
    {
        $outletId = $request->integer('outlet_id') ?: null;

        $family->load([
            'variants' => function ($query) use ($outletId) {
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

        // Compute stock status and outlet price for each variant
        $family->variants->each(function ($variant) use ($outletId) {
            $availableStock = 0;
            if ($variant->relationLoaded('inventories')) {
                $availableStock = max(0, (int) $variant->inventories->sum(
                    fn ($inv) => $inv->current_stock - $inv->reserved_stock
                ));
            }

            $variant->available_stock = $availableStock;
            $variant->stock_status = $availableStock <= 0
                ? 'out_of_stock'
                : ($availableStock <= 5 ? 'low' : 'available');

            // Override selling_price with outlet-specific price if available
            if ($outletId) {
                $outletPrice = $variant->priceForOutlet($outletId);
                $variant->selling_price = $outletPrice;
            }
        });

        // Other families for cross-sell recommendations
        $otherFamilies = ProductFamily::query()
            ->where('is_active', true)
            ->where('id', '!=', $family->id)
            ->with(['variants' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('name')
            ->limit(4)
            ->get();

        return Inertia::render('customer/product-detail', [
            'family' => $family,
            'otherFamilies' => $otherFamilies,
            'outletId' => $outletId,
        ]);
    }
}
