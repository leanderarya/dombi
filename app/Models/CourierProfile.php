<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CourierProfile extends Model
{
    protected $fillable = [
        'user_id',
        'courier_source',
        'outlet_id',
        'nominated_by',
        'approved_by',
        'approved_at',
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
            'approved_at' => 'datetime',
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

    public function assignedOutlets(): BelongsToMany
    {
        return $this->belongsToMany(Outlet::class, 'courier_outlet_assignments')
            ->withPivot('assigned_at')
            ->withTimestamps();
    }

    public function nominatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'nominated_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function scopePusat($query)
    {
        return $query->where('courier_source', 'pusat');
    }

    public function scopeOutlet($query)
    {
        return $query->where('courier_source', 'outlet');
    }

    public function scopePending($query)
    {
        return $query->where('invitation_status', 'pending');
    }

    public function scopeAvailableForOutlet($query, int $outletId)
    {
        return $query->where(function ($q) use ($outletId) {
            $q->where('courier_source', 'outlet')->where('outlet_id', $outletId)
              ->orWhereHas('assignedOutlets', fn ($q) => $q->where('outlets.id', $outletId));
        })->where('invitation_status', 'accepted');
    }
}
