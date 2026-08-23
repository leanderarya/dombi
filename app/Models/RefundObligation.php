<?php

namespace App\Models;

use App\Enums\RefundObligationStatus;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefundObligation extends Model
{
    protected static function booted(): void
    {
        static::saving(function (RefundObligation $obligation): void {
            if ((float) $obligation->amount <= 0) {
                throw new DomainException('Refund amount must be positive.');
            }
        });
    }

    protected $fillable = [
        'payment_attempt_id', 'amount', 'currency', 'reason', 'status',
        'destination_type', 'bank_name', 'account_number', 'account_holder',
        'ewallet_provider', 'ewallet_number', 'ewallet_holder', 'destination_submitted_at',
        'transfer_reference', 'transfer_note', 'proof_image', 'processed_by', 'processed_at', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'status' => RefundObligationStatus::class,
            'bank_name' => 'encrypted',
            'account_number' => 'encrypted',
            'account_holder' => 'encrypted',
            'ewallet_provider' => 'encrypted',
            'ewallet_number' => 'encrypted',
            'ewallet_holder' => 'encrypted',
            'destination_submitted_at' => 'datetime',
            'processed_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function paymentAttempt(): BelongsTo
    {
        return $this->belongsTo(PaymentAttempt::class);
    }
}
