<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

final class RefundStatusHistory extends Model
{
    use HasFactory;
    public const UPDATED_AT = null;

    public const EVENT_REFUND_REQUESTED = 'refund_requested';
    public const EVENT_DESTINATION_SUBMITTED = 'destination_submitted';
    public const EVENT_DESTINATION_UPDATED = 'destination_updated';
    public const EVENT_GUEST_DESTINATION_SUBMITTED_BY_OWNER = 'guest_destination_submitted_by_owner';
    public const EVENT_GUEST_DESTINATION_UPDATED_BY_OWNER = 'guest_destination_updated_by_owner';
    public const EVENT_PROCESSING_STARTED = 'processing_started';
    public const EVENT_PROCESSING_ROLLED_BACK = 'processing_rolled_back';
    public const EVENT_REFUND_REJECTED = 'refund_rejected';
    public const EVENT_REFUND_REOPENED = 'refund_reopened';
    public const EVENT_REFUND_COMPLETED = 'refund_completed';
    public const EVENT_REFUND_FAILED = 'refund_failed';

    protected $fillable = [
        'order_id', 'from_status', 'to_status', 'event', 'actor_type', 'actor_id', 'reason_code', 'note', 'metadata', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Refund history is immutable.'));
        static::deleting(fn () => throw new LogicException('Refund history is immutable.'));
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
