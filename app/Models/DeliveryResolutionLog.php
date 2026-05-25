<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryResolutionLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'order_id',
        'delivery_id',
        'resolution_type',
        'resolved_by',
        'resolution_notes',
        'retry_attempt',
        'previous_status',
        'new_status',
        'inventory_effect',
        'created_at',
    ];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
