<?php

namespace Tests\Unit;

use App\Enums\PaymentStatus;
use PHPUnit\Framework\TestCase;

class PaymentStatusTest extends TestCase
{
    public function test_payment_status_enum_has_expected_cases(): void
    {
        $cases = array_map(fn ($c) => $c->value, PaymentStatus::cases());
        $this->assertSame([
            'pending', 'paid', 'failed', 'expired',
            'refund_pending', 'refunded', 'refund_rejected', 'refund_failed',
        ], $cases);
    }

    public function test_is_terminal_returns_true_for_paid_and_refunded(): void
    {
        $this->assertTrue(PaymentStatus::Paid->isTerminal());
        $this->assertTrue(PaymentStatus::Refunded->isTerminal());
        $this->assertFalse(PaymentStatus::Pending->isTerminal());
    }
}
