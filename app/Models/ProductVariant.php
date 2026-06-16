<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductVariant extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'product_family_id', 'product_id', 'name', 'flavor', 'size',
        'sku', 'barcode', 'center_price', 'selling_price', 'center_stock', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'center_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'center_stock' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function family(): BelongsTo
    {
        return $this->belongsTo(ProductFamily::class, 'product_family_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function inventories(): HasMany
    {
        return $this->hasMany(OutletInventory::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function outletPrices(): HasMany
    {
        return $this->hasMany(OutletVariantPrice::class);
    }

    /**
     * Get selling price for a specific outlet.
     * Falls back to global selling_price if no override exists.
     */
    public function priceForOutlet(int $outletId): float
    {
        $override = $this->outletPrices()
            ->where('outlet_id', $outletId)
            ->value('selling_price');

        return $override !== null ? (float) $override : (float) $this->selling_price;
    }

    public function getOutletMarginAttribute(): float
    {
        return (float) $this->selling_price - (float) $this->center_price;
    }

    public function getFullNameAttribute(): string
    {
        $parts = array_filter([
            $this->family?->name,
            $this->flavor,
            $this->size,
        ]);

        return implode(' ', $parts);
    }

    /**
     * Total available stock across all active outlets.
     * Requires inventories to be eager-loaded for performance.
     */
    public function getAvailableStockAttribute(): int
    {
        return (int) $this->inventories->sum(fn ($inv) => $inv->current_stock - $inv->reserved_stock);
    }

    /**
     * Stock status for customer-facing display.
     * Returns: 'available', 'low', or 'out_of_stock'.
     */
    public function getStockStatusAttribute(): string
    {
        $stock = $this->available_stock;

        if ($stock <= 0) {
            return 'out_of_stock';
        }

        if ($stock <= 5) {
            return 'low';
        }

        return 'available';
    }
}
