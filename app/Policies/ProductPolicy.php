<?php

namespace App\Policies;

use App\Models\ExchangeRequestItem;
use App\Models\OutletProductPrice;
use App\Models\Product;
use App\Models\RestockRequestItem;
use App\Models\ReturnRequestItem;
use App\Models\StockMovement;
use App\Models\User;

class ProductPolicy
{
    /**
     * Determine whether the user can view any products.
     */
    public function viewAny(?User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the product.
     */
    public function view(?User $user, Product $product): bool
    {
        return true;
    }

    /**
     * Determine whether the user can create products.
     */
    public function create(?User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can update the product.
     */
    public function update(?User $user, Product $product): bool
    {
        return true;
    }

    /**
     * Determine whether the user can delete the product.
     *
     * Soft-delete guard: block if product has business history.
     */
    public function delete(?User $user, Product $product): bool
    {
        return !$this->hasBusinessHistory($product);
    }

    /**
     * Determine whether the user can restore the product.
     */
    public function restore(?User $user, Product $product): bool
    {
        return true;
    }

    /**
     * Determine whether the user can permanently delete the product.
     */
    public function forceDelete(?User $user, Product $product): bool
    {
        return !$this->hasBusinessHistory($product);
    }

    /**
     * Check if product has any business history that prevents deletion.
     */
    private function hasBusinessHistory(Product $product): bool
    {
        return $product->orderItems()->exists()
            || $product->inventories()->where('current_stock', '>', 0)->exists()
            || OutletProductPrice::where('product_id', $product->id)->exists()
            || StockMovement::where('product_id', $product->id)->exists()
            || ReturnRequestItem::where('product_id', $product->id)->exists()
            || ExchangeRequestItem::where('product_id', $product->id)
                ->orWhere('replacement_product_id', $product->id)
                ->exists()
            || RestockRequestItem::where('product_id', $product->id)->exists();
    }
}
