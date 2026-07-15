<?php

namespace Tests\Feature;

use App\Enums\PaymentMethod;
use App\Services\PaymentFeeCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentFeeIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_calculate_uses_subtotal_only(): void
    {
        $calc = app(PaymentFeeCalculator::class);
        $result = $calc->calculate(PaymentMethod::Qris, 100_000);
        $this->assertSame(0.0, $result['customer_fee']);
        $this->assertSame(700.0, $result['dombi_fee']);
    }

    public function test_checkout_calculate_above_threshold(): void
    {
        $calc = app(PaymentFeeCalculator::class);
        $result = $calc->calculate(PaymentMethod::Transfer, 600_000);
        $this->assertSame(2400.0, $result['customer_fee']);
        $this->assertSame(0.0, $result['dombi_fee']);
    }

    public function test_checkout_calculate_cc_always_customer(): void
    {
        $calc = app(PaymentFeeCalculator::class);
        $result = $calc->calculate(PaymentMethod::CreditCard, 100_000);
        $this->assertSame(2900.0, $result['customer_fee']);
    }

    public function test_ewallet_full_absorb_large_fee_no_cap(): void
    {
        $calc = app(PaymentFeeCalculator::class);
        $result = $calc->calculate(PaymentMethod::Ewallet, 400_000);
        $this->assertSame(0.0, $result['customer_fee']);
        $this->assertSame(6000.0, $result['dombi_fee']);
    }

    public function test_order_has_fee_breakdown_columns(): void
    {
        $order = \App\Models\Order::factory()->create([
            'absorbed_fee' => 1500,
            'gateway_fee' => 2000,
            'payment_fee' => 0,
        ]);
        $this->assertEquals(1500, $order->absorbed_fee);
        $this->assertEquals(2000, $order->gateway_fee);
    }
}
