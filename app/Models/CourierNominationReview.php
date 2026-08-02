<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourierNominationReview extends Model
{
    protected $fillable = [
        'courier_profile_id',
        'reviewer_id',
        'decision',
        'reason',
        'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
        ];
    }

    public function courierProfile(): BelongsTo
    {
        return $this->belongsTo(CourierProfile::class, 'courier_profile_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
