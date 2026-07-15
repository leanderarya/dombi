<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Failed = 'failed';
    case Expired = 'expired';
    case RefundPending = 'refund_pending';
    case Refunded = 'refunded';
    case RefundRejected = 'refund_rejected';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Paid, self::Refunded, self::RefundRejected], true);
    }

    public function isMutable(): bool
    {
        return ! $this->isTerminal();
    }
}
