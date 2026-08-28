<?php

namespace Tests\Unit;

use Tests\TestCase;

class OrderTimingConfigTest extends TestCase
{
    public function test_order_timing_defaults_are_centralized(): void
    {
        $this->assertSame(30, config('order.confirmation_timeout_minutes'));
        $this->assertSame(15, config('order.payment_retry_window_minutes'));
        $this->assertSame(24, config('order.doku_reconciliation_deadline_hours'));
    }

    public function test_order_timing_values_can_be_overridden(): void
    {
        config([
            'order.confirmation_timeout_minutes' => 45,
            'order.payment_retry_window_minutes' => 20,
            'order.doku_reconciliation_deadline_hours' => 48,
        ]);

        $this->assertSame(45, config('order.confirmation_timeout_minutes'));
        $this->assertSame(20, config('order.payment_retry_window_minutes'));
        $this->assertSame(48, config('order.doku_reconciliation_deadline_hours'));
    }
}
