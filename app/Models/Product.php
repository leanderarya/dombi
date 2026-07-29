<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'product_category_id', 'product_flavor_group_id', 'name', 'description',
        'flavor', 'size', 'normalized_size', 'size_value', 'size_unit',
        'sku', 'center_price', 'selling_price', 'center_stock', 'image', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'center_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'center_stock' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    public function flavorGroup(): BelongsTo
    {
        return $this->belongsTo(ProductFlavorGroup::class, 'product_flavor_group_id');
    }

    protected static function booted(): void
    {
        static::saving(function (self $model) {
            if ($model->size) {
                $model->normalized_size = strtolower(str_replace(' ', '', trim($model->size)));
                if (preg_match('/(\d+)\s*(ml|l|g|kg)/i', $model->size, $m)) {
                    $model->size_value = (int) $m[1];
                    $model->size_unit = strtolower($m[2]);
                }
            }
        });
    }

    public function getDisplayImageAttribute(): ?string
    {
        // Flavored product → flavor group image only (shared across all sizes)
        if ($this->product_flavor_group_id) {
            return $this->flavorGroup?->image;
        }

        // Flavorless product → own image
        return $this->image;
    }

    public function getHasFlavorImageAttribute(): bool
    {
        if ($this->product_flavor_group_id) {
            return ! empty($this->flavorGroup?->image);
        }

        return false;
    }

    public function inventories(): HasMany
    {
        return $this->hasMany(OutletInventory::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function outletPrices(): HasMany
    {
        return $this->hasMany(OutletProductPrice::class);
    }

    public function getOutletMarginAttribute(): float
    {
        return (float) $this->selling_price - (float) $this->center_price;
    }

    public function getMarginPercentAttribute(): float
    {
        return $this->center_price > 0
            ? (($this->selling_price - $this->center_price) / $this->center_price * 100)
            : 0;
    }

    public function getFullDisplayNameAttribute(): string
    {
        return trim(($this->category?->name ? $this->category->name.' - ' : '').$this->name);
    }

    public function getAvailableStockAttribute(): int
    {
        return (int) $this->inventories->sum(fn ($inv) => $inv->current_stock - $inv->reserved_stock);
    }

    public function getStockStatusAttribute(): string
    {
        if ($this->center_stock <= 0 && $this->available_stock <= 0) {
            return 'out_of_stock';
        }
        if ($this->center_stock <= 5 || $this->available_stock <= 5) {
            return 'low';
        }

        return 'available';
    }

    public function priceForOutlet(int $outletId): float
    {
        $override = $this->outletPrices()->where('outlet_id', $outletId)->value('selling_price');

        return $override !== null ? (float) $override : (float) $this->selling_price;
    }
}
