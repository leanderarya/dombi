<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CourierProfile extends Model
{
    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_AWAITING_ACTIVATION = 'approved_pending_activation';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'user_id',
        'courier_source',
        'outlet_id',
        'nominated_by',
        'nominee_name',
        'nominee_phone',
        'nominee_vehicle_plate',
        'nominee_face_photo',
        'nominee_vehicle_photo',
        'approved_by',
        'approved_at',
        'invitation_status',
        'invited_at',
        'accepted_at',
        'rejection_reason',
        'resubmitted_at',
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
            'resubmitted_at' => 'datetime',
            'total_deliveries' => 'integer',
            'rating' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isSubmitted(): bool
    {
        return $this->invitation_status === self::STATUS_SUBMITTED;
    }

    public function isAwaitingActivation(): bool
    {
        return $this->invitation_status === self::STATUS_AWAITING_ACTIVATION;
    }

    public function isActive(): bool
    {
        return $this->invitation_status === self::STATUS_ACTIVE;
    }

    public function isRejected(): bool
    {
        return $this->invitation_status === self::STATUS_REJECTED;
    }

    public function incrementDeliveries(): void
    {
        $this->increment('total_deliveries');
    }

    public function assignedOutlets(): BelongsToMany
    {
        return $this->belongsToMany(Outlet::class, 'courier_outlet_assignments')
            ->withPivot('assigned_at');
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function nominatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'nominated_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(CourierNominationReview::class, 'courier_profile_id');
    }

    public function scopePusat($query)
    {
        return $query->where('courier_source', 'pusat');
    }

    public function scopeOutlet($query)
    {
        return $query->where('courier_source', 'outlet');
    }

    public function scopeSubmitted($query)
    {
        return $query->where('invitation_status', self::STATUS_SUBMITTED);
    }

    public function scopeAwaitingActivation($query)
    {
        return $query->where('invitation_status', self::STATUS_AWAITING_ACTIVATION);
    }

    public function scopeActive($query)
    {
        return $query->where('invitation_status', self::STATUS_ACTIVE);
    }

    public function scopeRejected($query)
    {
        return $query->where('invitation_status', self::STATUS_REJECTED);
    }

    public function scopeAvailableForOutlet($query, int $outletId)
    {
        return $query->where(function ($q) use ($outletId) {
            $q->where('courier_source', 'outlet')->where('outlet_id', $outletId)
                ->orWhereHas('assignedOutlets', fn ($q) => $q->where('outlets.id', $outletId));
        })->where('invitation_status', self::STATUS_ACTIVE);
    }
}
