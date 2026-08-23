<?php

namespace App\Models;

use App\Enums\PaymentAttemptCreationState;
use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class PaymentAttempt extends Model
{
    protected $fillable = [
        'order_id', 'attempt_key', 'invoice_number', 'merchant_request_id', 'session_token',
        'payment_method', 'amount_snapshot', 'currency_snapshot', 'gateway_amount',
        'gateway_currency', 'gateway_transaction_id', 'gateway_status', 'creation_state',
        'settlement_status', 'verification_status', 'status_version', 'reconciliation_status',
        'reconciled_at', 'fulfilment_claimed_at', 'fulfilment_claimed_by', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount_snapshot' => 'decimal:2',
            'gateway_amount' => 'decimal:2',
            'creation_state' => PaymentAttemptCreationState::class,
            'settlement_status' => PaymentAttemptSettlementStatus::class,
            'verification_status' => PaymentAttemptVerificationStatus::class,
            'reconciled_at' => 'datetime',
            'fulfilment_claimed_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (PaymentAttempt $attempt): void {
            if ($attempt->isDirty(['order_id', 'attempt_key', 'invoice_number', 'merchant_request_id', 'session_token', 'payment_method', 'amount_snapshot', 'currency_snapshot'])) {
                throw new LogicException('Payment attempt identity and snapshots are immutable.');
            }
        });
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
