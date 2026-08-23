<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;

final readonly class NormalizedPaymentEvent
{
    public CarbonInterface $receivedAt;

    public function __construct(
        public string $source,
        public string $gatewayStatus,
        public int|float|string|null $amount,
        public string $currency,
        public ?string $gatewayReference,
        CarbonInterface|string $receivedAt,
        public array $rawEvidence,
    ) {
        $this->receivedAt = Carbon::parse($receivedAt);
    }

    public function withGatewayReference(?string $reference): self
    {
        return new self($this->source, $this->gatewayStatus, $this->amount, $this->currency, $reference, $this->receivedAt, $this->rawEvidence);
    }
}
