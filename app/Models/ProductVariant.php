<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Backward compatibility alias for Product.
 * Points to new table products after Task 2 refactor.
 * Will be deleted after backend migrates to ProductCategory/Product.
 */
class ProductVariant extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'products';

    protected $fillable = [
        'product_family_id', 'product_category_id', 'product_id', 'name', 'description', 'flavor', 'size',
        'sku', 'barcode', 'center_price', 'selling_price', 'center_stock', 'is_active', 'image',
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

    // Handle old attribute product_family_id mapping to product_category_id
    public function getProductFamilyIdAttribute(): ?int
    {
        return $this->attributes['product_category_id'] ?? null;
    }

    public function setProductFamilyIdAttribute($value): void
    {
        // Resolve factory or model to id if needed
        if ($value instanceof \Illuminate\Database\Eloquent\Model) {
            $value = $value->getKey();
        } elseif ($value instanceof \Illuminate\Database\Eloquent\Factories\Factory) {
            // Will be resolved by Laravel's factory handling before setter? Keep raw if needed
            // But try to avoid double factory creation - return early if factory instance
            // Actually if factory instance is passed, Laravel will create model first then call setter with instance.
            // Handled above.
        }
        $this->attributes['product_category_id'] = $value instanceof \Illuminate\Database\Eloquent\Model ? $value->getKey() : $value;
    }

    public function family(): BelongsTo
    {
        return $this->belongsTo(ProductFamily::class, 'product_category_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    public function product(): BelongsTo
    {
        // Legacy relation - points to same table now, keep nullable
        return $this->belongsTo(Product::class, 'product_category_id');
    }

    public function inventories(): HasMany
    {
        return $this->hasMany(OutletInventory::class, 'product_id');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'product_id');
    }

    public function outletPrices(): HasMany
    {
        // Try new model first, fallback to old alias which also points to new table
        return $this->hasMany(OutletProductPrice::class, 'product_id');
    }

    public function variantPrices(): HasMany
    {
        return $this->hasMany(OutletVariantPrice::class, 'product_id');
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

    public function getMarginPercentAttribute(): float
    {
        return $this->center_price > 0
            ? (($this->selling_price - $this->center_price) / $this->center_price * 100)
            : 0;
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

    public function getFullDisplayNameAttribute(): string
    {
        return trim(($this->family?->name ? $this->family->name.' - ' : '').$this->name);
    }

    /**
     * Total available stock across all active outlets.
     */
    public function getAvailableStockAttribute(): int
    {
        return (int) $this->inventories->sum(fn ($inv) => $inv->current_stock - $inv->reserved_stock);
    }

    /**
     * Stock status for customer-facing display.
     */
    public function getStockStatusAttribute(): string
    {
        $stock = $this->available_stock;
        $center = $this->center_stock ?? 0;

        if ($center <= 0 && $stock <= 0) {
            return 'out_of_stock';
        }
        if ($center <= 5 || $stock <= 5) {
            return 'low';
        }
        return 'available';
    }
}
