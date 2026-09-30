<?php

namespace App\Policies;

use App\Models\ExchangeRequestItem;
use App\Models\OfflineSale;
use App\Models\OrderItem;
use App\Models\OutletInventory;
use App\Models\OutletProductPrice;
use App\Models\ProductCategory;
use App\Models\RestockRequestItem;
use App\Models\ReturnRequestItem;
use App\Models\StockMovement;
use App\Models\User;

class ProductCategoryPolicy
{
    /**
     * Determine whether the user can view any categories.
     */
    public function viewAny(?User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the category.
     */
    public function view(?User $user, ProductCategory $category): bool
    {
        return true;
    }

    /**
     * Determine whether the user can create categories.
     */
    public function create(?User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can update the category.
     */
    public function update(?User $user, ProductCategory $category): bool
    {
        return true;
    }

    /**
     * Determine whether the user can delete the category.
     *
     * Cannot delete if has active products or products with business history.
     */
    public function delete(?User $user, ProductCategory $category): bool
    {
        return ! $this->hasActiveProducts($category) && ! $this->hasProductsWithHistory($category);
    }

    /**
     * Determine whether the user can restore the category.
     */
    public function restore(?User $user, ProductCategory $category): bool
    {
        return true;
    }

    /**
     * Determine whether the user can permanently delete the category.
     *
     * Stricter than the soft-delete rule on purpose: products.product_category_id
     * cascades on delete, so erasing a category would take its products with it.
     * The check includes trashed products for the same reason — the FK does not
     * care that they were soft deleted.
     */
    public function forceDelete(?User $user, ProductCategory $category): bool
    {
        return ! $category->products()->withTrashed()->exists();
    }

    /**
     * Check if category has active products.
     */
    private function hasActiveProducts(ProductCategory $category): bool
    {
        return $category->activeProducts()->exists();
    }

    /**
     * Check if any product in category has business history.
     */
    private function hasProductsWithHistory(ProductCategory $category): bool
    {
        $productIds = $category->products()->pluck('id');

        if ($productIds->isEmpty()) {
            return false;
        }

        // Check order_items via product relation would be captured by querying order_items directly in product check,
        // but for performance we do bulk exists checks per table.

        // Any product with order items
        if (OrderItem::whereIn('product_id', $productIds)->exists()) {
            return true;
        }

        // Any product with current_stock > 0 in inventories
        if (OutletInventory::whereIn('product_id', $productIds)->where('current_stock', '>', 0)->exists()) {
            return true;
        }

        if (OutletProductPrice::whereIn('product_id', $productIds)->exists()) {
            return true;
        }

        if (StockMovement::whereIn('product_id', $productIds)->exists()) {
            return true;
        }

        if (ReturnRequestItem::whereIn('product_id', $productIds)->exists()) {
            return true;
        }

        if (ExchangeRequestItem::whereIn('product_id', $productIds)
            ->orWhereIn('replacement_product_id', $productIds)
            ->exists()) {
            return true;
        }

        if (RestockRequestItem::whereIn('product_id', $productIds)->exists()) {
            return true;
        }

        // Mirrors ProductPolicy: offline_sales cascade on product delete, so a
        // category carrying them must not be removable either.
        if (OfflineSale::whereIn('product_id', $productIds)->exists()) {
            return true;
        }

        return false;
    }
}
