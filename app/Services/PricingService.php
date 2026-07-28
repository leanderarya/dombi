<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\OutletProductPrice;
use App\Models\PricingAuditLog;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Collection;

class PricingService
{
    /**
     * Get selling price for a product at a specific outlet.
     * Falls back to global selling_price if no outlet override exists.
     * Outlet ID is optional to support simple product price lookups.
     */
    public function getSellingPrice(Product $product, ?int $outletId = null): float
    {
        if ($outletId !== null) {
            $override = OutletProductPrice::where('outlet_id', $outletId)
                ->where('product_id', $product->id)
                ->value('selling_price');

            if ($override !== null) {
                return (float) $override;
            }
        }

        return (float) $product->selling_price;
    }

    /**
     * Get all product prices for an outlet (with fallback to global).
     * Returns collection of { product_id, name, category_name, center_price, selling_price, margin, has_override }.
     */
    public function getOutletPrices(int $outletId): Collection
    {
        $overrides = OutletProductPrice::where('outlet_id', $outletId)
            ->pluck('selling_price', 'product_id');

        return Product::where('is_active', true)
            ->with('category:id,name')
            ->orderBy('name')
            ->get()
            ->map(function (Product $product) use ($overrides) {
                $hasOverride = $overrides->has($product->id);
                $sellingPrice = $hasOverride
                    ? (float) $overrides[$product->id]
                    : (float) $product->selling_price;
                $centerPrice = (float) $product->center_price;

                return [
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'category_name' => $product->category?->name,
                    'center_price' => $centerPrice,
                    'selling_price' => $sellingPrice,
                    'margin' => $sellingPrice - $centerPrice,
                    'has_override' => $hasOverride,
                ];
            });
    }

    /**
     * Update selling price for a product at an outlet.
     */
    public function updatePrice(int $outletId, int $productId, float $newPrice, User $user): OutletProductPrice
    {
        $existing = OutletProductPrice::where('outlet_id', $outletId)
            ->where('product_id', $productId)
            ->first();

        $oldPrice = $existing?->selling_price;

        $price = OutletProductPrice::updateOrCreate(
            ['outlet_id' => $outletId, 'product_id' => $productId],
            ['selling_price' => $newPrice],
        );

        $this->logAudit($outletId, $productId, $oldPrice, $newPrice, 'update', $user);

        return $price;
    }

    /**
     * Bulk adjust all prices for an outlet by a fixed amount.
     */
    public function bulkAdjust(int $outletId, float $adjustment, User $user): int
    {
        $products = Product::where('is_active', true)->get();
        $count = 0;

        foreach ($products as $product) {
            $currentPrice = $this->getSellingPrice($product, $outletId);
            $newPrice = max(0, $currentPrice + $adjustment);

            OutletProductPrice::updateOrCreate(
                ['outlet_id' => $outletId, 'product_id' => $product->id],
                ['selling_price' => $newPrice],
            );

            $this->logAudit($outletId, $product->id, $currentPrice, $newPrice, 'bulk_update', $user);
            $count++;
        }

        return $count;
    }

    /**
     * Copy all prices from one outlet to another.
     */
    public function copyPrices(int $sourceOutletId, int $targetOutletId, User $user): int
    {
        $sourcePrices = OutletProductPrice::where('outlet_id', $sourceOutletId)->get();
        $count = 0;

        foreach ($sourcePrices as $sourcePrice) {
            $existingTarget = OutletProductPrice::where('outlet_id', $targetOutletId)
                ->where('product_id', $sourcePrice->product_id)
                ->first();

            $oldPrice = $existingTarget?->selling_price;

            OutletProductPrice::updateOrCreate(
                ['outlet_id' => $targetOutletId, 'product_id' => $sourcePrice->product_id],
                ['selling_price' => $sourcePrice->selling_price],
            );

            $this->logAudit($targetOutletId, $sourcePrice->product_id, $oldPrice, $sourcePrice->selling_price, 'copy', $user);
            $count++;
        }

        return $count;
    }

    /**
     * Get impact preview for a center price change.
     * Returns how many outlets would be affected and how many would have negative/low margin.
     */
    public function getCenterPriceImpact(int $productId, float $newCenterPrice): array
    {
        $overrides = OutletProductPrice::where('product_id', $productId)->get();
        $totalOutlets = Outlet::where('status', 'active')->count();

        $negativeMargin = 0;
        $lowMargin = 0;

        foreach ($overrides as $override) {
            $margin = (float) $override->selling_price - $newCenterPrice;
            $marginPct = (float) $override->selling_price > 0 ? ($margin / (float) $override->selling_price) * 100 : 0;

            if ($margin < 0) {
                $negativeMargin++;
            } elseif ($marginPct < 10) {
                $lowMargin++;
            }
        }

        return [
            'total_outlets' => $totalOutlets,
            'affected_outlets' => $overrides->count(),
            'negative_margin_outlets' => $negativeMargin,
            'low_margin_outlets' => $lowMargin,
        ];
    }

    /**
     * Reset outlet price to global (delete override).
     */
    public function resetToGlobal(int $outletId, int $productId, User $user): void
    {
        $existing = OutletProductPrice::where('outlet_id', $outletId)
            ->where('product_id', $productId)
            ->first();

        if ($existing) {
            $oldPrice = (float) $existing->selling_price;
            $existing->delete();

            // Get global price for audit log
            $globalPrice = Product::where('id', $productId)->value('selling_price');

            $this->logAudit($outletId, $productId, $oldPrice, (float) $globalPrice, 'reset', $user);
        }
    }

    /**
     * Log a pricing change.
     */
    private function logAudit(int $outletId, int $productId, ?float $oldPrice, float $newPrice, string $action, User $user): void
    {
        try {
            PricingAuditLog::create([
                'outlet_id' => $outletId,
                'product_id' => $productId,
                'old_price' => $oldPrice,
                'new_price' => $newPrice,
                'action' => $action,
                'changed_by' => $user->id,
            ]);
        } catch (\Exception $e) {
            logger()->warning('Pricing audit log failed', [
                'outlet_id' => $outletId,
                'product_id' => $productId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
