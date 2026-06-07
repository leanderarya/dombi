<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ReturnRequest extends Model
{
    const STATUS_DRAFT = 'draft';
    const STATUS_SUBMITTED = 'submitted';
    const STATUS_APPROVED = 'approved';
    const STATUS_REJECTED = 'rejected';
    const STATUS_RECEIVED_AT_CENTER = 'received_at_center';
    const STATUS_COMPLETED = 'completed';

    const ALL_STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_SUBMITTED,
        self::STATUS_APPROVED,
        self::STATUS_REJECTED,
        self::STATUS_RECEIVED_AT_CENTER,
        self::STATUS_COMPLETED,
    ];

    const REASONS = [
        'slow_moving' => 'Slow Moving',
        'near_expiry' => 'Near Expiry',
        'damaged_packaging' => 'Damaged Packaging',
        'wrong_distribution' => 'Wrong Distribution',
        'other' => 'Other',
    ];

    protected $fillable = [
        'outlet_id',
        'requested_by',
        'reason',
        'notes',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_notes',
        'received_by',
        'received_at',
        'received_notes',
        'total_value',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'received_at' => 'datetime',
        'total_value' => 'decimal:2',
    ];

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ReturnRequestItem::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(ReturnStatusHistory::class)->orderBy('created_at');
    }

    public function exchangeRequest(): HasOne
    {
        return $this->hasOne(ExchangeRequest::class);
    }

    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    public function isSubmitted(): bool
    {
        return $this->status === self::STATUS_SUBMITTED;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }

    public function isReceivedAtCenter(): bool
    {
        return $this->status === self::STATUS_RECEIVED_AT_CENTER;
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    public function reasonLabel(): string
    {
        return self::REASONS[$this->reason] ?? $this->reason;
    }
}
