<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use App\Enums\RefundObligationStatus;
use App\Enums\RefundRejectionReason;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Order extends Model
{
    use HasFactory;

    public const STATUS_PENDING_CONFIRMATION = 'pending_confirmation';

    public const STATUS_CONFIRMED = 'confirmed';

    public const STATUS_PREPARING = 'preparing';

    public const STATUS_READY_FOR_PICKUP = 'ready_for_pickup';

    public const STATUS_PICKED_UP = 'picked_up';

    public const STATUS_DELIVERING = 'delivering';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED_BY_CUSTOMER = 'cancelled_by_customer';

    public const STATUS_CANCELLED_BY_OUTLET = 'cancelled_by_outlet';

    public const STATUS_REJECTED_BY_OUTLET = 'rejected_by_outlet';

    public const STATUS_FAILED_DELIVERY = 'failed_delivery';

    public const STATUS_EXPIRED = 'expired';

    public const ALL_STATUSES = [
        self::STATUS_PENDING_CONFIRMATION,
        self::STATUS_CONFIRMED,
        self::STATUS_PREPARING,
        self::STATUS_READY_FOR_PICKUP,
        self::STATUS_PICKED_UP,
        self::STATUS_DELIVERING,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED_BY_CUSTOMER,
        self::STATUS_CANCELLED_BY_OUTLET,
        self::STATUS_REJECTED_BY_OUTLET,
        self::STATUS_FAILED_DELIVERY,
        self::STATUS_EXPIRED,
    ];

    public const ACTIVE_STATUSES = [
        self::STATUS_PENDING_CONFIRMATION,
        self::STATUS_CONFIRMED,
        self::STATUS_PREPARING,
        self::STATUS_READY_FOR_PICKUP,
        self::STATUS_PICKED_UP,
        self::STATUS_DELIVERING,
    ];

    public const HISTORY_STATUSES = [
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED_BY_CUSTOMER,
        self::STATUS_CANCELLED_BY_OUTLET,
        self::STATUS_REJECTED_BY_OUTLET,
        self::STATUS_FAILED_DELIVERY,
        self::STATUS_EXPIRED,
    ];

    public const ACTIVE_REFUND_PAYMENT_STATUSES = [
        PaymentStatus::RefundPending->value,
        PaymentStatus::RefundInProgress->value,
        PaymentStatus::RefundRejected->value,
        PaymentStatus::RefundFailed->value,
    ];

    public const FULFILLMENT_PICKUP = 'pickup';

    public const FULFILLMENT_DELIVERY_DOMBI = 'delivery_dombi';

    public const FULFILLMENT_DELIVERY_OJOL = 'delivery_ojol';

    public const DELIVERY_FULFILLMENT_TYPES = [
        self::FULFILLMENT_DELIVERY_DOMBI,
        self::FULFILLMENT_DELIVERY_OJOL,
    ];

    public const REFUND_DESTINATION_MISSING = 'missing';

    public const REFUND_DESTINATION_VALID = 'valid';

    public const REFUND_DESTINATION_INVALID = 'invalid';

    protected $fillable = [
        'customer_id', 'outlet_id', 'recommended_outlet_id', 'order_code', 'recovery_token', 'guest_token', 'status', 'fulfillment_type',
        'subtotal', 'delivery_fee', 'payment_method', 'payment_fee', 'total', 'customer_name', 'customer_phone',
        'payment_status', 'doku_order_id', 'paid_at',
        'recipient_name', 'recipient_phone',
        'customer_address', 'customer_address_detail', 'customer_landmark', 'latitude', 'longitude',
        'delivery_distance_km', 'notes', 'ordered_at', 'confirmation_expires_at',
        'confirmed_at', 'confirmed_by',
        'rejected_at', 'rejected_by', 'rejection_reason', 'rejection_note',
        'cancelled_at', 'cancelled_by', 'cancellation_reason', 'cancellation_note',
        'expired_at', 'expired_reason',
        'completed_at', 'refunded_at', 'refund_amount', 'refund_reason', 'doku_refund_id',
        'refund_requested_at', 'refund_proof_image', 'refunded_by', 'refund_rejected_reason',
        'refund_destination_type', 'refund_bank_name', 'refund_account_number', 'refund_account_holder',
        'refund_ewallet_provider', 'refund_ewallet_number', 'refund_ewallet_holder', 'refund_destination_submitted_at',
        'refund_started_at', 'refund_started_by', 'refund_transfer_reference', 'refund_transfer_note',
        'refund_rejected_at', 'refund_rejected_by', 'refund_rejection_note',
        'refund_destination_status',
        'gateway_fee', 'absorbed_fee',
    ];

    protected $appends = [
        'tracking_url',
    ];

    protected static function booted(): void
    {
        static::creating(function (Order $order): void {
            if (empty($order->recovery_token)) {
                $order->recovery_token = static::generateRecoveryToken();
            }
            if (empty($order->guest_token)) {
                $order->guest_token = Str::random(32);
            }
            if (empty($order->confirmation_expires_at) && $order->status === self::STATUS_PENDING_CONFIRMATION) {
                $outlet = $order->outlet_id ? Outlet::find($order->outlet_id) : null;
                $timeout = $outlet?->confirmation_timeout_minutes ?? config('order.confirmation_timeout_minutes', 15);
                $order->confirmation_expires_at = now()->addMinutes($timeout);
            }
        });
    }

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'delivery_distance_km' => 'decimal:2',
            'payment_fee' => 'decimal:2',
            'total' => 'decimal:2',
            'ordered_at' => 'datetime',
            'paid_at' => 'datetime',
            'confirmation_expires_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'rejected_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'expired_at' => 'datetime',
            'completed_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'refunded_at' => 'datetime',
            'refund_amount' => 'decimal:2',
            'refund_requested_at' => 'datetime',
            'refund_destination_submitted_at' => 'datetime',
            'refund_started_at' => 'datetime',
            'refund_rejected_at' => 'datetime',
            'refund_bank_name' => 'encrypted',
            'refund_account_number' => 'encrypted',
            'refund_account_holder' => 'encrypted',
            'refund_ewallet_provider' => 'encrypted',
            'refund_ewallet_number' => 'encrypted',
            'refund_ewallet_holder' => 'encrypted',
            'refund_destination_status' => 'string',
            'gateway_fee' => 'decimal:2',
            'absorbed_fee' => 'decimal:2',
        ];
    }

    public function getPaymentStatusEnumAttribute(): PaymentStatus
    {
        return PaymentStatus::from($this->payment_status ?? 'pending');
    }

    public function paymentIsFulfilmentEligible(): bool
    {
        return $this->payment_status === PaymentStatus::Paid->value
            && $this->paymentAttempts()->where('settlement_status', 'paid')
                ->where('verification_status', 'verified')
                ->where('amount_snapshot', $this->total)
                ->exists();
    }

    public function scopePaymentStatus(Builder $query, PaymentStatus $status): Builder
    {
        return $query->where('payment_status', $status->value);
    }

    public function scopeWithCanonicalRefund(Builder $query, ?array $statuses = null, ?bool $hasDestination = null, bool $staleInProgressOnly = false): Builder
    {
        return $query->whereExists(function ($selected) use ($statuses, $hasDestination): void {
            $selected->selectRaw('1')
                ->from('refund_obligations')
                ->join('payment_attempts', 'payment_attempts.id', '=', 'refund_obligations.payment_attempt_id')
                ->whereColumn('payment_attempts.order_id', 'orders.id')
                ->whereColumn('refund_obligations.reason', 'orders.refund_reason')
                ->where(function ($metadata): void {
                    $metadata->whereNull('payment_attempts.metadata->provenance')
                        ->orWhere('payment_attempts.metadata->provenance', '!=', 'synthetic_legacy_refund');
                })
                ->when($statuses, fn ($query) => $query->whereIn('refund_obligations.status', $statuses))
                ->when($hasDestination !== null, fn ($query) => $hasDestination
                    ? $query->whereNotNull('refund_obligations.destination_type')
                    : $query->whereNull('refund_obligations.destination_type'))
                ->when($staleInProgressOnly, fn ($query) => $query->where('refund_obligations.status', RefundObligationStatus::InProgress->value)->where('refund_obligations.updated_at', '<=', now()->subHours(24)))
                ->whereNotExists(function ($newer) {
                    $newer->selectRaw('1')
                        ->from('payment_attempts as newer_attempts')
                        ->join('refund_obligations as newer_obligations', 'newer_obligations.payment_attempt_id', '=', 'newer_attempts.id')
                        ->whereColumn('newer_attempts.order_id', 'orders.id')
                        ->whereColumn('newer_obligations.reason', 'orders.refund_reason')
                        ->where(function ($newerSelection): void {
                            $newerSelection->whereColumn('newer_attempts.id', '>', 'payment_attempts.id')
                                ->orWhere(function ($sameAttempt): void {
                                    $sameAttempt->whereColumn('newer_attempts.id', 'payment_attempts.id')
                                        ->whereColumn('newer_obligations.id', '>', 'refund_obligations.id');
                                });
                        })
                        ->where(function ($metadata): void {
                            $metadata->whereNull('newer_attempts.metadata->provenance')
                                ->orWhere('newer_attempts.metadata->provenance', '!=', 'synthetic_legacy_refund');
                        });
                });
        });
    }

    public function scopeRefundable(Builder $query): Builder
    {
        return $query->whereIn('payment_status', [
            PaymentStatus::RefundPending->value,
            PaymentStatus::RefundInProgress->value,
            PaymentStatus::Refunded->value,
            PaymentStatus::RefundRejected->value,
            PaymentStatus::RefundFailed->value,
        ]);
    }

    public function scopeVisibleAsCustomerActive(Builder $query): Builder
    {
        return $query->where(function ($visibility) {
            $visibility->where(function ($operational) {
                $operational->whereIn('status', self::ACTIVE_STATUSES)
                    ->where(function ($payment) {
                        $payment->whereNull('payment_status')
                            ->orWhere('payment_status', PaymentStatus::Pending->value)
                            ->orWhere('payment_status', PaymentStatus::Paid->value)
                            ->orWhere(function ($retryable) {
                                $retryable->whereIn('payment_status', [
                                    PaymentStatus::Failed->value,
                                    PaymentStatus::Expired->value,
                                ])->where('status', self::STATUS_PENDING_CONFIRMATION);
                            });
                    })
                    ->where(function ($confirmation) {
                        $confirmation->where('status', '!=', self::STATUS_PENDING_CONFIRMATION)
                            ->orWhereNull('confirmation_expires_at')
                            ->orWhere('confirmation_expires_at', '>', now());
                    });
            })->orWhereIn('payment_status', [
                PaymentStatus::RefundPending->value,
                PaymentStatus::RefundInProgress->value,
                PaymentStatus::RefundFailed->value,
            ])->orWhere(function (Builder $q) {
                $q->where('payment_status', PaymentStatus::RefundRejected->value)
                    ->whereIn('refund_rejected_reason', [
                        RefundRejectionReason::InvalidDestination->value,
                        RefundRejectionReason::IncompleteDestination->value,
                    ]);
            });
        });
    }

    public function scopeVisibleAsCustomerHistory(Builder $query): Builder
    {
        return $query->whereIn('status', self::HISTORY_STATUSES)
            ->where(function ($payment) {
                $payment->whereNull('payment_status')
                    ->orWhere(function ($q) {
                        $q->whereNotIn('payment_status', [
                            PaymentStatus::RefundPending->value,
                            PaymentStatus::RefundInProgress->value,
                            PaymentStatus::RefundFailed->value,
                        ])->where(function ($sub) {
                            $sub->where('payment_status', '!=', PaymentStatus::RefundRejected->value)
                                ->orWhereNotIn('refund_rejected_reason', [
                                    RefundRejectionReason::InvalidDestination->value,
                                    RefundRejectionReason::IncompleteDestination->value,
                                ]);
                        });
                    });
            });
    }

    private static function generateRecoveryToken(): string
    {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excluded I, O, 0, 1 to avoid confusion

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $token = '';

            for ($i = 0; $i < 8; $i++) {
                $token .= $chars[random_int(0, strlen($chars) - 1)];
            }

            if (! static::where('recovery_token', $token)->exists()) {
                return $token;
            }
        }

        // fallback — should never reach here
        return strtoupper(bin2hex(random_bytes(4)));
    }

    public function isPendingConfirmation(): bool
    {
        return $this->status === self::STATUS_PENDING_CONFIRMATION;
    }

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED_BY_OUTLET;
    }

    public function isCancelledByCustomer(): bool
    {
        return $this->status === self::STATUS_CANCELLED_BY_CUSTOMER;
    }

    public function isExpired(): bool
    {
        return $this->status === self::STATUS_EXPIRED;
    }

    public function isConfirmationOverdue(): bool
    {
        return $this->isPendingConfirmation()
            && $this->confirmation_expires_at !== null
            && $this->confirmation_expires_at->isPast();
    }

    public function confirmationTimeRemaining(): ?int
    {
        if (! $this->isPendingConfirmation() || $this->confirmation_expires_at === null) {
            return null;
        }

        return max(0, now()->diffInSeconds($this->confirmation_expires_at, false));
    }

    public function getTrackingUrlAttribute(): ?string
    {
        if (empty($this->recovery_token)) {
            return null;
        }

        return route('track', ['token' => $this->recovery_token]);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function recommendedOutlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class, 'recommended_outlet_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function delivery(): HasOne
    {
        return $this->hasOne(Delivery::class);
    }

    public function paymentTransactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    public function paymentAttempts(): HasMany
    {
        return $this->hasMany(PaymentAttempt::class);
    }

    public function refundObligation(): HasOne
    {
        return $this->hasOneThrough(RefundObligation::class, PaymentAttempt::class)
            ->where('refund_obligations.reason', $this->refund_reason)
            ->whereColumn('refund_obligations.payment_attempt_id', 'payment_attempts.id');
    }

    public function selectedRefundObligation(): ?RefundObligation
    {
        $reason = $this->refund_reason;
        if (! $reason) {
            return null;
        }

        if ($this->relationLoaded('selectedRefundObligation')) {
            return $this->getRelation('selectedRefundObligation');
        }

        if ($this->relationLoaded('paymentAttempts')) {
            $obligation = $this->paymentAttempts
                ->filter(fn (PaymentAttempt $attempt): bool => ($attempt->metadata['provenance'] ?? null) !== 'synthetic_legacy_refund')
                ->sortByDesc('id')
                ->flatMap(fn (PaymentAttempt $attempt) => $attempt->relationLoaded('refundObligations') ? $attempt->refundObligations->where('reason', $reason)->sortByDesc('id') : collect())
                ->first();
            $this->setRelation('selectedRefundObligation', $obligation);

            return $obligation;
        }

        $obligation = RefundObligation::query()
            ->where('reason', $reason)
            ->whereHas('paymentAttempt', function ($query) {
                $query->where('order_id', $this->id)
                    ->where(function ($metadata): void {
                        $metadata->whereNull('metadata->provenance')
                            ->orWhere('metadata->provenance', '!=', 'synthetic_legacy_refund');
                    });
            })
            ->orderByDesc(
                PaymentAttempt::query()
                    ->select('id')
                    ->whereColumn('payment_attempts.id', 'refund_obligations.payment_attempt_id')
            )
            ->orderByDesc('refund_obligations.id')
            ->first();

        $this->setRelation('selectedRefundObligation', $obligation);

        return $obligation;
    }

    public function refundStatusHistories(): HasMany
    {
        return $this->hasMany(RefundStatusHistory::class)->orderBy('created_at')->orderBy('id');
    }

    public function isGuestCustomer(): bool
    {
        return $this->relationLoaded('customer')
            ? $this->customer?->user_id === null
            : ! $this->customer()->whereNotNull('user_id')->exists();
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    public function isFinalized(): bool
    {
        return in_array($this->status, self::HISTORY_STATUSES, true);
    }

    public function isPickup(): bool
    {
        return $this->fulfillment_type === self::FULFILLMENT_PICKUP;
    }

    public function isDelivery(): bool
    {
        return in_array($this->fulfillment_type, self::DELIVERY_FULFILLMENT_TYPES, true);
    }
}
