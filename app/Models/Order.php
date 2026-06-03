<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    use HasFactory;

    public const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'];

    public const HISTORY_STATUSES = ['completed', 'cancelled', 'failed'];

    protected $fillable = [
        'customer_id', 'outlet_id', 'recommended_outlet_id', 'order_code', 'status', 'fulfillment_type',
        'subtotal', 'delivery_fee', 'payment_method', 'payment_fee', 'total', 'customer_name', 'customer_phone',
        'customer_address', 'customer_address_detail', 'customer_landmark', 'latitude', 'longitude',
        'delivery_distance_km', 'notes', 'ordered_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'delivery_distance_km' => 'decimal:2',
            'payment_fee' => 'decimal:2',
            'total' => 'decimal:2',
            'ordered_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function recommendedOutlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class, 'recommended_outlet_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function delivery(): HasOne
    {
        return $this->hasOne(Delivery::class);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    public function isFinalized(): bool
    {
        return in_array($this->status, self::HISTORY_STATUSES, true);
    }
}
