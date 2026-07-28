<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestockRequestItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'restock_request_id',
        'product_id',
        'product_variant_id',
        'requested_quantity',
        'approved_quantity',
    ];

    public function restockRequest(): BelongsTo
    {
        return $this->belongsTo(RestockRequest::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_id');
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
