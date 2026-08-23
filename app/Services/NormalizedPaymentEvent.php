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

    public function withGatewayReference(?string $reference): self
    {
        return new self($this->source, $this->gatewayStatus, $this->amount, $this->currency, $reference, $this->receivedAt, $this->rawEvidence);
    }
}
