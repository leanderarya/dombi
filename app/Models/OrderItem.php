<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id', 'product_id', 'product_variant_id', 'product_name',
        'variant_name_snapshot', 'quantity', 'price',
        'center_price_snapshot', 'selling_price_snapshot', 'outlet_margin_snapshot',
        'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'center_price_snapshot' => 'decimal:2',
            'selling_price_snapshot' => 'decimal:2',
            'outlet_margin_snapshot' => 'decimal:2',
            'subtotal' => 'decimal:2',
        ];
    }

    public function getCenterSubtotalAttribute(): float
    {
        return (float) $this->center_price_snapshot * $this->quantity;
    }

    public function getMarginSubtotalAttribute(): float
    {
        return (float) $this->outlet_margin_snapshot * $this->quantity;
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
