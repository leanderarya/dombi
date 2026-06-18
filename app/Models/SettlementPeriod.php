<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SettlementPeriod extends Model
{
    protected $fillable = [
        'outlet_id', 'period_type', 'period_start', 'period_end', 'due_date',
        'orders_count', 'units_sold', 'gross_revenue', 'center_share',
        'outlet_margin', 'settled_amount', 'outstanding_amount', 'calculated_at',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'gross_revenue' => 'decimal:2',
            'center_share' => 'decimal:2',
            'outlet_margin' => 'decimal:2',
            'settled_amount' => 'decimal:2',
            'outstanding_amount' => 'decimal:2',
            'calculated_at' => 'datetime',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }
}
