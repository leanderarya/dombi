<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use App\Enums\PaymentStatus;

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

    public const FULFILLMENT_PICKUP = 'pickup';

    public const FULFILLMENT_DELIVERY_DOMBI = 'delivery_dombi';

    public const FULFILLMENT_DELIVERY_OJOL = 'delivery_ojol';

    public const DELIVERY_FULFILLMENT_TYPES = [
        self::FULFILLMENT_DELIVERY_DOMBI,
        self::FULFILLMENT_DELIVERY_OJOL,
    ];

    public const PENDING_CONFIRMATION = self::STATUS_PENDING_CONFIRMATION;

    public const REJECTED = self::STATUS_REJECTED_BY_OUTLET;

    public const CANCELLED_BY_CUSTOMER = self::STATUS_CANCELLED_BY_CUSTOMER;

    public const FAILED_DELIVERY = self::STATUS_FAILED_DELIVERY;

    public const EXPIRED = self::STATUS_EXPIRED;

    protected $fillable = [
        'customer_id', 'outlet_id', 'recommended_outlet_id', 'order_code', 'recovery_token', 'status', 'fulfillment_type',
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
            if (empty($order->confirmation_expires_at) && $order->status === self::STATUS_PENDING_CONFIRMATION) {
                $outlet = $order->outlet_id ? \App\Models\Outlet::find($order->outlet_id) : null;
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
            'gateway_fee' => 'decimal:2',
            'absorbed_fee' => 'decimal:2',
        ];
    }

    public function getPaymentStatusEnumAttribute(): PaymentStatus
    {
        return PaymentStatus::from($this->payment_status ?? 'pending');
    }

    public function scopePaymentStatus(\Illuminate\Database\Eloquent\Builder $query, PaymentStatus $status): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where('payment_status', $status->value);
    }

    public function scopeRefundable(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereIn('payment_status', [
            PaymentStatus::Paid->value,
            PaymentStatus::RefundPending->value,
        ]);
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
        return $this->status === self::REJECTED;
    }

    public function isCancelledByCustomer(): bool
    {
        return $this->status === self::CANCELLED_BY_CUSTOMER;
    }

    public function isExpired(): bool
    {
        return $this->status === self::EXPIRED;
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
