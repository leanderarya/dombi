<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutletOperatingHours extends Model
{
    use HasFactory;

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

    /**
     * Compare to the minute, the unit the owner actually sets.
     *
     * The owner form submits H:i, so "open until midnight" is stored as 23:59
     * and read back as 23:59:00 from the time column. Comparing that against a
     * clock carrying seconds makes "23:59:30" sort after "23:59:00", so the
     * outlet reported itself closed for the last minute of every day.
     */
    public function isOpenAt(string $time): bool
    {
        if ($this->is_closed) {
            return false;
        }

        $at = substr($time, 0, 5);

        return $at >= substr($this->open_time, 0, 5) && $at <= substr($this->close_time, 0, 5);
    }
}
