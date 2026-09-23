<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class DeliveryTier extends Model
{
    use HasFactory;

    public const PRICING_CACHE_KEY = 'delivery_tiers.active';

    protected $fillable = [
        'min_km',
        'max_km',
        'fee',
        'is_active',
        'sort_order',
    ];

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::PRICING_CACHE_KEY));
        static::deleted(fn () => Cache::forget(self::PRICING_CACHE_KEY));
    }

    protected function casts(): array
    {
        return [
            'min_km' => 'decimal:2',
            'max_km' => 'decimal:2',
            'fee' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order');
    }
}
