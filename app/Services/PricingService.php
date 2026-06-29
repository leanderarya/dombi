<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\OutletVariantPrice;
use App\Models\PricingAuditLog;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Support\Collection;

class PricingService
{
    /**
     * Get selling price for a variant at a specific outlet.
     * Falls back to global selling_price if no outlet override exists.
     */
    public function getSellingPrice(ProductVariant $variant, int $outletId): float
    {
        $override = OutletVariantPrice::where('outlet_id', $outletId)
            ->where('product_variant_id', $variant->id)
            ->value('selling_price');

        return $override !== null ? (float) $override : (float) $variant->selling_price;
    }

    /**
     * Get all variant prices for an outlet (with fallback to global).
     * Returns collection of { variant, center_price, selling_price, margin, has_override }.
     */
    public function getOutletPrices(int $outletId): Collection
    {
        $overrides = OutletVariantPrice::where('outlet_id', $outletId)
            ->pluck('selling_price', 'product_variant_id');

        return ProductVariant::where('is_active', true)
            ->with('family:id,name')
            ->orderBy('name')
            ->get()
            ->map(function (ProductVariant $variant) use ($overrides) {
                $hasOverride = $overrides->has($variant->id);
                $sellingPrice = $hasOverride
                    ? (float) $overrides[$variant->id]
                    : (float) $variant->selling_price;
                $centerPrice = (float) $variant->center_price;

                return [
                    'variant_id' => $variant->id,
                    'name' => $variant->full_name,
                    'family_name' => $variant->family?->name,
                    'flavor' => $variant->flavor,
                    'size' => $variant->size,
                    'center_price' => $centerPrice,
                    'selling_price' => $sellingPrice,
                    'margin' => $sellingPrice - $centerPrice,
                    'has_override' => $hasOverride,
                ];
            });
    }

    /**
     * Update selling price for a variant at an outlet.
     */
    public function updatePrice(int $outletId, int $variantId, float $newPrice, User $user): OutletVariantPrice
    {
        $existing = OutletVariantPrice::where('outlet_id', $outletId)
            ->where('product_variant_id', $variantId)
            ->first();

        $oldPrice = $existing?->selling_price;

        $price = OutletVariantPrice::updateOrCreate(
            ['outlet_id' => $outletId, 'product_variant_id' => $variantId],
            ['selling_price' => $newPrice],
        );

        $this->logAudit($outletId, $variantId, $oldPrice, $newPrice, 'update', $user);

        return $price;
    }

    /**
     * Bulk adjust all prices for an outlet by a fixed amount.
     */
    public function bulkAdjust(int $outletId, float $adjustment, User $user): int
    {
        $variants = ProductVariant::where('is_active', true)->get();
        $count = 0;

        foreach ($variants as $variant) {
            $currentPrice = $this->getSellingPrice($variant, $outletId);
            $newPrice = max(0, $currentPrice + $adjustment);

            OutletVariantPrice::updateOrCreate(
                ['outlet_id' => $outletId, 'product_variant_id' => $variant->id],
                ['selling_price' => $newPrice],
            );

            $this->logAudit($outletId, $variant->id, $currentPrice, $newPrice, 'bulk_update', $user);
            $count++;
        }

        return $count;
    }

    /**
     * Copy all prices from one outlet to another.
     */
    public function copyPrices(int $sourceOutletId, int $targetOutletId, User $user): int
    {
        $sourcePrices = OutletVariantPrice::where('outlet_id', $sourceOutletId)->get();
        $count = 0;

        foreach ($sourcePrices as $sourcePrice) {
            $existingTarget = OutletVariantPrice::where('outlet_id', $targetOutletId)
                ->where('product_variant_id', $sourcePrice->product_variant_id)
                ->first();

            $oldPrice = $existingTarget?->selling_price;

            OutletVariantPrice::updateOrCreate(
                ['outlet_id' => $targetOutletId, 'product_variant_id' => $sourcePrice->product_variant_id],
                ['selling_price' => $sourcePrice->selling_price],
            );

            $this->logAudit($targetOutletId, $sourcePrice->product_variant_id, $oldPrice, $sourcePrice->selling_price, 'copy', $user);
            $count++;
        }

        return $count;
    }

    /**
     * Get impact preview for a center price change.
     * Returns how many outlets would be affected and how many would have negative/low margin.
     */
    public function getCenterPriceImpact(int $variantId, float $newCenterPrice): array
    {
        $overrides = OutletVariantPrice::where('product_variant_id', $variantId)->get();
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
    public function resetToGlobal(int $outletId, int $variantId, User $user): void
    {
        $existing = OutletVariantPrice::where('outlet_id', $outletId)
            ->where('product_variant_id', $variantId)
            ->first();

        if ($existing) {
            $oldPrice = (float) $existing->selling_price;
            $existing->delete();

            // Get global price for audit log
            $globalPrice = ProductVariant::where('id', $variantId)->value('selling_price');

            $this->logAudit($outletId, $variantId, $oldPrice, (float) $globalPrice, 'reset', $user);
        }
    }

    /**
     * Log a pricing change.
     */
    private function logAudit(int $outletId, int $variantId, ?float $oldPrice, float $newPrice, string $action, User $user): void
    {
        try {
            PricingAuditLog::create([
                'outlet_id' => $outletId,
                'product_variant_id' => $variantId,
                'old_price' => $oldPrice,
                'new_price' => $newPrice,
                'action' => $action,
                'changed_by' => $user->id,
            ]);
        } catch (\Exception $e) {
            logger()->warning('Pricing audit log failed', [
                'outlet_id' => $outletId,
                'variant_id' => $variantId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
