<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutletVariantPrice extends Model
{
    protected $fillable = [
        'outlet_id',
        'product_variant_id',
        'selling_price',
    ];

    protected function casts(): array
    {
        return [
            'selling_price' => 'decimal:2',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }
}
