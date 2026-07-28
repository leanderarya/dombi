<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutletInventory extends Model
{
    use HasFactory;

    protected $fillable = [
        'outlet_id', 'product_id', 'current_stock',
        'reserved_stock', 'minimum_stock', 'is_active', 'last_restock_at',
    ];

    protected function casts(): array
    {
        return [
            'last_restock_at' => 'datetime',
            'is_active' => 'boolean',
            'current_stock' => 'integer',
            'reserved_stock' => 'integer',
            'minimum_stock' => 'integer',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function getAvailableStockAttribute(): int
    {
        return $this->current_stock - $this->reserved_stock;
    }
}
