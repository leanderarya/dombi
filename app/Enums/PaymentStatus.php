<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Failed = 'failed';
    case Expired = 'expired';
    case RefundPending = 'refund_pending';
    case RefundInProgress = 'refund_in_progress';
    case Refunded = 'refunded';
    case RefundRejected = 'refund_rejected';

    // Legacy status retained for backward compatibility with older orders.
    // No longer produced by new code (refunds are manual, see Track B).
    case RefundFailed = 'refund_failed';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Refunded, self::RefundRejected, self::RefundFailed], true);
    }

    public function isMutable(): bool
    {
        return ! $this->isTerminal();
    }
}
