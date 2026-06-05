<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutletInventory extends Model
{
    use HasFactory;

    protected $fillable = [
        'outlet_id', 'product_id', 'product_variant_id', 'current_stock',
        'reserved_stock', 'minimum_stock', 'last_restock_at',
    ];

    protected function casts(): array
    {
        return ['last_restock_at' => 'datetime'];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function getAvailableStockAttribute(): int
    {
        return $this->current_stock - $this->reserved_stock;
    }
}
