<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Delivery extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'courier_id',
        'status',
        'pickup_time',
        'delivered_time',
        'failed_reason',
        'notes',
        'proof_image',
        'assigned_by',
        'assigned_at',
    ];

    protected function casts(): array
    {
        return [
            'pickup_time' => 'datetime',
            'delivered_time' => 'datetime',
            'assigned_at' => 'datetime',
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
}
