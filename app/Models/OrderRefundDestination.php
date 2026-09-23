<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

final class OrderRefundDestination extends Model
{
    public const UPDATED_AT = null;

    public const EVENT_SUBMITTED = 'submitted';

    public const EVENT_UPDATED = 'updated';

    public const EVENT_BACKFILLED = 'backfilled';

    protected $fillable = [
        'order_id', 'event', 'destination_type',
        'bank_name', 'account_number', 'account_holder',
        'ewallet_provider', 'ewallet_number', 'ewallet_holder',
        'actor_type', 'actor_id', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'bank_name' => 'encrypted',
            'account_number' => 'encrypted',
            'account_holder' => 'encrypted',
            'ewallet_provider' => 'encrypted',
            'ewallet_number' => 'encrypted',
            'ewallet_holder' => 'encrypted',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        self::updating(fn () => throw new LogicException('Refund destination history is immutable.'));
        self::deleting(fn () => throw new LogicException('Refund destination history is immutable.'));
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
