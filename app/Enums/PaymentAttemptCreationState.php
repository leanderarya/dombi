<?php

namespace App\Enums;

enum PaymentAttemptCreationState: string
{
    case Initiated = 'initiated';
    case Pending = 'pending';
    case Created = 'created';
    case Unknown = 'unknown';
    case Failed = 'failed';
}
