<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SettlementPayment extends Model
{
    protected $fillable = [
        'outlet_id', 'reference_number', 'payment_date', 'amount',
        'proof_image', 'notes', 'status', 'verified_by', 'verified_at',
        'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'amount' => 'decimal:2',
            'verified_at' => 'datetime',
        ];
    }

    public const STATUS_PENDING = 'pending_verification';
    public const STATUS_VERIFIED = 'verified';
    public const STATUS_REJECTED = 'rejected';

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isVerified(): bool
    {
        return $this->status === self::STATUS_VERIFIED;
    }

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }
}
