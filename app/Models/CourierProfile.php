<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourierProfile extends Model
{
    protected $fillable = [
        'user_id',
        'invitation_status',
        'invited_at',
        'accepted_at',
        'total_deliveries',
        'rating',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'invited_at' => 'datetime',
            'accepted_at' => 'datetime',
            'total_deliveries' => 'integer',
            'rating' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isPending(): bool
    {
        return $this->invitation_status === 'pending';
    }

    public function isAccepted(): bool
    {
        return $this->invitation_status === 'accepted';
    }

    public function isRejected(): bool
    {
        return $this->invitation_status === 'rejected';
    }

    public function incrementDeliveries(): void
    {
        $this->increment('total_deliveries');
    }
}
