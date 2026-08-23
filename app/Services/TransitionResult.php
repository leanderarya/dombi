<?php

namespace App\Services;

final readonly class TransitionResult
{
    public function __construct(
        public bool $changed,
        public bool $fulfilmentWinner = false,
        public bool $needsReview = false,
    ) {}
}
