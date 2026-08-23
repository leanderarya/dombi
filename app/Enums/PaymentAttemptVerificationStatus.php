<?php

namespace App\Enums;

enum PaymentAttemptVerificationStatus: string
{
    case Verified = 'verified';
    case NeedsReview = 'needs_review';
}
