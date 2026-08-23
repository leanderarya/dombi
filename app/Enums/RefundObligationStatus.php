<?php

namespace App\Enums;

enum RefundObligationStatus: string
{
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Rejected = 'rejected';
    case Failed = 'failed';
    case NeedsReview = 'needs_review';
}
