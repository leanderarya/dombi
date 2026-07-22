<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Delivery extends Model
{
    use HasFactory;

    public const RESOLUTION_STATUSES = [
        'retry_delivery',
        'returned_to_outlet',
        'cancelled_and_released',
    ];

    public const RESOLUTION_TRANSITIONS = [
        'failed' => ['retry_delivery', 'returned_to_outlet', 'cancelled_and_released'],
        'returned_to_outlet' => ['cancelled_and_released'],
    ];

    public const RETURN_STATUSES = [
        'returning_to_outlet',
        'returned_to_outlet',
    ];

    protected $fillable = [
        'order_id',
        'courier_id',
        'status',
        'pickup_time',
        'delivered_time',
        'failed_reason',
        'resolution_status',
        'resolution_notes',
        'resolved_by',
        'resolved_at',
        'notes',
        'proof_image',
        'assigned_by',
        'assigned_at',
        'retry_count',
        'delivered_to',
        'delivery_note',
        'rejection_reason',
        'rejection_note',
        'rejected_at',
        'return_status',
        'return_confirmed_by',
        'return_confirmed_at',
        'return_notes',
        'external_courier_name',
        'external_courier_phone',
        'external_plate_number',
        'courier_cost',
        'courier_type',
    ];

    protected function casts(): array
    {
        return [
            'pickup_time' => 'datetime',
            'delivered_time' => 'datetime',
            'assigned_at' => 'datetime',
            'resolved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'return_confirmed_at' => 'datetime',
            'courier_cost' => 'decimal:2',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function returnConfirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'return_confirmed_by');
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(DeliveryStatusHistory::class);
    }

    public function canResolveTo(string $status): bool
    {
        $currentStatus = $this->status;
        $allowed = self::RESOLUTION_TRANSITIONS[$currentStatus] ?? [];

        return in_array($status, $allowed, true);
    }

    public function isReturning(): bool
    {
        return $this->return_status === 'returning_to_outlet';
    }

    public function isReturned(): bool
    {
        return $this->return_status === 'returned_to_outlet';
    }

    public function isActive(): bool
    {
        return in_array($this->status, ['waiting_pickup', 'picked_up', 'delivering'], true);
    }
}
