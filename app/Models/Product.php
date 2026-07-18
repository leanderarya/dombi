<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @deprecated Use ProductFamily & ProductVariant instead. This model is kept for legacy
 * data compatibility and will be removed in Phase 9. New code must use product_variant_id.
 */
class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'product_category_id', 'name', 'slug', 'description', 'size',
        'unit', 'price', 'center_price', 'selling_price', 'image', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'center_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function getOutletMarginAttribute(): float
    {
        return (float) $this->selling_price - (float) $this->center_price;
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    public function inventories(): HasMany
    {
        return $this->hasMany(OutletInventory::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function restockRequestItems(): HasMany
    {
        return $this->hasMany(RestockRequestItem::class);
    }
}
