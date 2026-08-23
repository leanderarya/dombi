<?php

namespace App\Enums;

enum PaymentAttemptSettlementStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Failed = 'failed';
    case Expired = 'expired';
    case Unknown = 'unknown';
}
