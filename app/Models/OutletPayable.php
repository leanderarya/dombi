<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutletPayable extends Model
{
    protected $fillable = [
        'outlet_id', 'order_id', 'type', 'amount',
        'center_share', 'outlet_margin', 'reference_type', 'reference_id', 'notes', 'created_by',
        'due_date', 'paid_amount', 'remaining_amount',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'center_share' => 'decimal:2',
            'outlet_margin' => 'decimal:2',
            'due_date' => 'date',
            'paid_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
