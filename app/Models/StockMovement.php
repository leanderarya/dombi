<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class StockMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'outlet_id', 'product_id', 'product_variant_id', 'type', 'quantity',
        'before_stock', 'after_stock', 'before_reserved', 'after_reserved',
        'reference_type', 'reference_id', 'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'before_stock' => 'integer',
            'after_stock' => 'integer',
            'before_reserved' => 'integer',
            'after_reserved' => 'integer',
            'quantity' => 'integer',
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

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }

    public function getReferenceDescriptionAttribute(): string
    {
        if (!$this->reference_type || !$this->reference_id) {
            return '-';
        }

        $class = class_basename($this->reference_type);

        return "{$class} #{$this->reference_id}";
    }
}
