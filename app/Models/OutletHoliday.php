<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutletHoliday extends Model
{
    protected $fillable = [
        'outlet_id',
        'start_date',
        'end_date',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function isActive(): bool
    {
        $today = now()->toDateString();

        return $today >= $this->start_date->toDateString()
            && $today <= $this->end_date->toDateString();
    }
}
