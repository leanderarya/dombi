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
        'retry_delivery' => ['returned_to_outlet', 'cancelled_and_released'],
        'returned_to_outlet' => ['cancelled_and_released'],
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
    ];

    protected function casts(): array
    {
        return [
            'pickup_time' => 'datetime',
            'delivered_time' => 'datetime',
            'assigned_at' => 'datetime',
            'resolved_at' => 'datetime',
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
}
