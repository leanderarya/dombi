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
        'sku', 'barcode', 'center_price', 'selling_price', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'center_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
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
}
