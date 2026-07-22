<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SettlementPaymentAllocation extends Model
{
    protected $fillable = [
        'settlement_payment_id',
        'settlement_id',
        'allocated_amount',
    ];

    protected function casts(): array
    {
        return [
            'allocated_amount' => 'decimal:2',
        ];
    }

    public function settlementPayment(): BelongsTo
    {
        return $this->belongsTo(SettlementPayment::class);
    }

    public function settlement(): BelongsTo
    {
        return $this->belongsTo(Settlement::class);
    }
}
