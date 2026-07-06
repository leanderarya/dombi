<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Outlet extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id', 'name', 'kelurahan', 'kecamatan', 'city', 'province',
        'postal_code', 'address', 'latitude', 'longitude', 'phone',
        'pic_name', 'pic_phone', 'pic_position',
        'operational_notes', 'delivery_radius_km', 'prep_estimate_minutes',
        'status', 'confirmation_timeout_minutes',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    // ─── Scopes ────────────────────────────────────────────

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    public function scopeOperational(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('status', '!=', 'archived');
    }

    // ─── Status Helpers ────────────────────────────────────

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isTemporarilyClosed(): bool
    {
        return $this->status === 'temporarily_closed';
    }

    public function isMaintenance(): bool
    {
        return $this->status === 'maintenance';
    }

    public function isArchived(): bool
    {
        return $this->status === 'archived';
    }

    public function acceptsOrders(): bool
    {
        return $this->status === 'active';
    }

    // ─── Relationships ─────────────────────────────────────

    public function inventories(): HasMany
    {
        return $this->hasMany(OutletInventory::class);
    }

    public function activeInventories(): HasMany
    {
        return $this->hasMany(OutletInventory::class)->where('is_active', true);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function restockRequests(): HasMany
    {
        return $this->hasMany(RestockRequest::class);
    }

    public function stockDistributions(): HasMany
    {
        return $this->hasMany(StockDistribution::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function variantPrices(): HasMany
    {
        return $this->hasMany(OutletVariantPrice::class);
    }

    public function holidays(): HasMany
    {
        return $this->hasMany(OutletHoliday::class);
    }

    public function operatingHours(): HasMany
    {
        return $this->hasMany(OutletOperatingHours::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(OutletAuditLog::class);
    }
}
