<?php

namespace Tests\Unit;

use App\Enums\PaymentStatus;
use App\Enums\RefundRejectionReason;
use PHPUnit\Framework\TestCase;

class PaymentStatusTest extends TestCase
{
    public function test_payment_status_enum_has_expected_cases(): void
    {
        $cases = array_map(fn ($c) => $c->value, PaymentStatus::cases());
        $this->assertSame([
            'pending', 'paid', 'failed', 'expired',
            'refund_pending', 'refund_in_progress', 'refunded', 'refund_rejected', 'refund_failed',
        ], $cases);
    }

    public function test_refund_in_progress_is_non_terminal_and_mutable(): void
    {
        $this->assertSame('refund_in_progress', PaymentStatus::RefundInProgress->value);
        $this->assertFalse(PaymentStatus::RefundInProgress->isTerminal());
        $this->assertTrue(PaymentStatus::RefundInProgress->isMutable());
    }

    public function test_is_terminal_returns_true_only_for_terminal_states(): void
    {
        $this->assertFalse(PaymentStatus::Paid->isTerminal());
        $this->assertTrue(PaymentStatus::Refunded->isTerminal());
        $this->assertFalse(PaymentStatus::Pending->isTerminal());
    }

    public function test_refund_rejection_reasons_have_expected_values_labels_and_resubmission_rules(): void
    {
        $this->assertSame([
            'invalid_destination',
            'incomplete_destination',
            'payment_unverified',
            'duplicate_refund',
            'other',
        ], array_map(fn ($case) => $case->value, RefundRejectionReason::cases()));

        $this->assertSame([
            'Data tujuan refund tidak valid',
            'Data belum lengkap',
            'Pembayaran tidak terverifikasi',
            'Refund duplikat',
            'Lainnya',
        ], array_map(fn ($case) => $case->label(), RefundRejectionReason::cases()));

        $this->assertSame([
            true,
            true,
            false,
            false,
            false,
        ], array_map(fn ($case) => $case->canResubmit(), RefundRejectionReason::cases()));
    }
}
