<?php

namespace App\Console\Commands;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use Illuminate\Console\Command;

class VerifyPaymentCutover extends Command
{
    protected $signature = 'payments:verify-cutover';

    protected $description = 'Verify canonical payment runtime and disabled legacy writes';

    public function handle(): int
    {
        $errors = [];

        if (config('doku.legacy_writes_enabled', true) !== false) {
            $errors[] = 'legacy payment writes must resolve to PAYMENTS_LEGACY_WRITES_ENABLED=false';
        }

        if (! PaymentAttempt::query()->exists()) {
            $errors[] = 'canonical database must contain at least one canonical payment attempt';
        }

        PaymentAttempt::query()->each(function (PaymentAttempt $attempt) use (&$errors): void {
            $order = $attempt->order;
            if ($order === null) {
                $errors[] = "canonical attempt {$attempt->id} references missing order";
                return;
            }
            $issues = [];
            if (blank($attempt->invoice_number) || $attempt->invoice_number !== $order->order_code) {
                $issues[] = 'invoice';
            }
            $attemptAmount = self::minorUnits($attempt->amount_snapshot);
            $orderAmount = self::minorUnits($order->total);
            if ($attemptAmount === null || $orderAmount === null || $attemptAmount !== $orderAmount) {
                $issues[] = 'amount';
            }
            if (blank($attempt->currency_snapshot) || strtoupper($attempt->currency_snapshot) !== strtoupper((string) config('doku.currency', 'IDR'))) {
                $issues[] = 'currency';
            }
            if (! self::isAllowedState($attempt->settlement_status, PaymentAttemptSettlementStatus::cases())
                || ! self::isAllowedState($attempt->verification_status, PaymentAttemptVerificationStatus::cases())) {
                $issues[] = 'state';
            }
            if ($issues !== []) {
                $errors[] = "canonical attempt {$attempt->id} has invalid order/invoice/amount/currency/state (".implode(', ', $issues).')';
            }
        });

        RefundObligation::query()->each(function (RefundObligation $obligation) use (&$errors): void {
            $attempt = $obligation->paymentAttempt;
            if ($attempt === null || $attempt->order === null) {
                $errors[] = "refund obligation {$obligation->id} references missing attempt/order";
                return;
            }
            $refundAmount = self::minorUnits($obligation->amount);
            if ($refundAmount === null || $refundAmount <= 0 || blank($obligation->currency) || strtoupper($obligation->currency) !== strtoupper((string) $attempt->currency_snapshot)) {
                $errors[] = "refund obligation {$obligation->id} has invalid amount/currency for attempt {$attempt->id}";
            }
        });

        if ($errors !== []) {
            $this->error(implode(PHP_EOL, $errors));
            return self::FAILURE;
        }

        $this->info('READY: canonical payment runtime valid and legacy writes disabled.');
        return self::SUCCESS;
    }

    private static function isAllowedState(mixed $value, array $cases): bool
    {
        $value = $value instanceof \BackedEnum ? $value->value : $value;

        return is_string($value) && in_array($value, array_map(static fn (\BackedEnum $case): string => $case->value, $cases), true);
    }

    private static function minorUnits(mixed $value): ?int
    {
        if (! is_int($value) && ! is_float($value) && ! is_string($value)) {
            return null;
        }

        $normalized = trim((string) $value);
        if (! preg_match('/^[+-]?\d+(?:\.\d{1,2})?$/', $normalized)) {
            return null;
        }

        $negative = str_starts_with($normalized, '-');
        $normalized = ltrim($normalized, '+-');
        [$whole, $fraction] = array_pad(explode('.', $normalized, 2), 2, '');
        $fraction = str_pad($fraction, 2, '0');

        return ($negative ? -1 : 1) * ((int) $whole * 100 + (int) $fraction);
    }
}
