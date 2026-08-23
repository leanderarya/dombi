<?php

namespace App\Enums;

enum PaymentAttemptCreationState: string
{
    case Initiated = 'initiated';
    case Created = 'created';
    case Unknown = 'unknown';
    case Failed = 'failed';
}
