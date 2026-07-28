<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Favorite extends Model
{
    protected $fillable = [
        'customer_id',
        'product_id',
        'product_variant_id',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function getProductVariantIdAttribute(): ?int
    {
        return $this->attributes['product_id'] ?? null;
    }

    public function setProductVariantIdAttribute($value): void
    {
        $this->attributes['product_id'] = $value instanceof \Illuminate\Database\Eloquent\Model ? $value->getKey() : $value;
    }
}
