<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfflineSale extends Model
{
    protected $fillable = [
        'outlet_id',
        'product_id',
        'product_variant_id',
        'quantity',
        'center_price',
        'total_amount',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'center_price' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function variant(): BelongsTo
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
