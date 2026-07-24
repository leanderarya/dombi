<?php

namespace App\Enums;

enum RefundRejectionReason: string
{
    case InvalidDestination = 'invalid_destination';
    case IncompleteDestination = 'incomplete_destination';
    case PaymentUnverified = 'payment_unverified';
    case DuplicateRefund = 'duplicate_refund';
    case Other = 'other';

    public function canResubmit(): bool
    {
        return in_array($this, [self::InvalidDestination, self::IncompleteDestination], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::InvalidDestination => 'Data tujuan refund tidak valid',
            self::IncompleteDestination => 'Data belum lengkap',
            self::PaymentUnverified => 'Pembayaran tidak terverifikasi',
            self::DuplicateRefund => 'Refund duplikat',
            self::Other => 'Lainnya',
        };
    }
}
