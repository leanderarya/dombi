<?php

namespace App\Services;

use Carbon\CarbonInterface;

final readonly class NormalizedPaymentEvent
{
    public function __construct(
        public string $source,
        public string $gatewayStatus,
        public int|float|string|null $amount,
        public string $currency,
        public ?string $gatewayReference,
        public CarbonInterface $receivedAt,
        public array $rawEvidence,
    ) {}
}
