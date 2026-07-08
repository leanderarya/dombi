<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class CourierInvitation extends Model
{
    protected $fillable = [
        'invited_by',
        'courier_user_id',
        'phone',
        'name',
        'token',
        'status',
        'sent_at',
        'accepted_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'accepted_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function courierUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_user_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending' && $this->expires_at->isFuture();
    }

    public function isExpired(): bool
    {
        return $this->status === 'expired' || $this->expires_at->isPast();
    }

    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    public static function generateToken(): string
    {
        return Str::random(64);
    }
}
