<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutletOperatingHours extends Model
{
    protected $fillable = [
        'outlet_id',
        'day_of_week',
        'open_time',
        'close_time',
        'is_closed',
    ];

    protected function casts(): array
    {
        return [
            'day_of_week' => 'integer',
            'is_closed' => 'boolean',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function isOpenAt(string $time): bool
    {
        if ($this->is_closed) {
            return false;
        }

        return $time >= $this->open_time && $time <= $this->close_time;
    }
}
