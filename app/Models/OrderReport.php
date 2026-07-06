<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderReport extends Model
{
    public const TYPE_NOT_RECEIVED = 'not_received';

    public const TYPE_WRONG_ITEMS = 'wrong_items';

    public const TYPE_DAMAGED = 'damaged';

    public const TYPE_OTHER = 'other';

    public const TYPES = [
        self::TYPE_NOT_RECEIVED,
        self::TYPE_WRONG_ITEMS,
        self::TYPE_DAMAGED,
        self::TYPE_OTHER,
    ];

    public const STATUS_PENDING = 'pending';

    public const STATUS_INVESTIGATING = 'investigating';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_INVESTIGATING,
        self::STATUS_RESOLVED,
        self::STATUS_REJECTED,
    ];

    public const ACTIVE_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_INVESTIGATING,
    ];

    protected $fillable = [
        'order_id',
        'customer_id',
        'type',
        'notes',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
        ];
    }

    protected function appends(): array
    {
        return ['type_label', 'status_label'];
    }

    public function getTypeLabelAttribute(): string
    {
        return $this->typeLabel();
    }

    public function getStatusLabelAttribute(): string
    {
        return $this->statusLabel();
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    public function scopeResolved(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_RESOLVED);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isResolved(): bool
    {
        return $this->status === self::STATUS_RESOLVED;
    }

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }

    public function typeLabel(): string
    {
        return match ($this->type) {
            self::TYPE_NOT_RECEIVED => 'Barang tidak diterima',
            self::TYPE_WRONG_ITEMS => 'Barang salah',
            self::TYPE_DAMAGED => 'Barang rusak/cacat',
            self::TYPE_OTHER => 'Lainnya',
            default => $this->type,
        };
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            self::STATUS_PENDING => 'Menunggu Tinjauan',
            self::STATUS_INVESTIGATING => 'Sedang Ditinjau',
            self::STATUS_RESOLVED => 'Telah Diselesaikan',
            self::STATUS_REJECTED => 'Tidak Dapat Diproses',
            default => $this->status ?? 'Menunggu Tinjauan',
        };
    }

    public static function statusLabels(): array
    {
        return [
            self::STATUS_PENDING => 'Menunggu Tinjauan',
            self::STATUS_INVESTIGATING => 'Sedang Ditinjau',
            self::STATUS_RESOLVED => 'Telah Diselesaikan',
            self::STATUS_REJECTED => 'Tidak Dapat Diproses',
        ];
    }
}
