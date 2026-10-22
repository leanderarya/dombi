<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SettlementReconciliationIssue extends Model
{
    protected $fillable = [
        'settlement_id',
        'status',
        'settlement_snapshot',
        'source_snapshot',
        'detected_at',
    ];

    protected function casts(): array
    {
        return [
            'settlement_snapshot' => 'array',
            'source_snapshot' => 'array',
            'detected_at' => 'datetime',
        ];
    }

    public function settlement(): BelongsTo
    {
        return $this->belongsTo(Settlement::class);
    }
}
