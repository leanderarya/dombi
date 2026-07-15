<?php

namespace App\Services;

use App\Enums\PaymentMethod;

class PaymentFeeCalculator
{
    public const THRESHOLD = 500_000;

    /**
     * Calculate fee breakdown.
     * Threshold uses subtotal only (no delivery).
     * < THRESHOLD: QRIS/Transfer/E-Wallet fully absorbed by Dombi (no cap)
     * >= THRESHOLD: customer pays
     * CC: always customer pays, ignore threshold.
     *
     * @return array{customer_fee: float, dombi_fee: float, gateway_fee: float}
     */
    public function calculate(PaymentMethod $method, float $subtotal): array
    {
        $method = $method->normalized();
        $rate = $this->feeRate($method);
        $gatewayFee = round($subtotal * $rate, 2);

        if ($method === PaymentMethod::CreditCard) {
            return [
                'customer_fee' => $gatewayFee,
                'dombi_fee' => 0.0,
                'gateway_fee' => $gatewayFee,
            ];
        }

        if ($subtotal < $this->threshold()) {
            return [
                'customer_fee' => 0.0,
                'dombi_fee' => $gatewayFee,
                'gateway_fee' => $gatewayFee,
            ];
        }

        return [
            'customer_fee' => $gatewayFee,
            'dombi_fee' => 0.0,
            'gateway_fee' => $gatewayFee,
        ];
    }

    private function threshold(): float
    {
        try {
            return (float) config('doku.fee_threshold', self::THRESHOLD);
        } catch (\Throwable) {
            return (float) self::THRESHOLD;
        }
    }

    private function feeRate(PaymentMethod $method): float
    {
        $default = match ($method) {
            PaymentMethod::Qris => 0.007,
            PaymentMethod::Transfer => 0.004,
            PaymentMethod::Ewallet => 0.015,
            PaymentMethod::CreditCard => 0.029,
            default => 0,
        };
        try {
            return (float) config("doku.methods.{$method->value}.fee_rate", $default);
        } catch (\Throwable) {
            return $default;
        }
    }
}
