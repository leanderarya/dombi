<?php

namespace Tests\Unit;

use App\Enums\PaymentMethod;
use App\Services\PaymentFeeCalculator;
use PHPUnit\Framework\TestCase;

class PaymentFeeCalculatorTest extends TestCase
{
    private PaymentFeeCalculator $calc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calc = new PaymentFeeCalculator();
    }

    public function test_below_threshold_qris_fee_fully_absorbed_by_dombi(): void
    {
        $result = $this->calc->calculate(PaymentMethod::Qris, 100_000);
        $this->assertSame(0.0, $result['customer_fee']);
        $this->assertSame(700.0, $result['dombi_fee']);
        $this->assertSame(700.0, $result['gateway_fee']);
    }

    public function test_below_threshold_ewallet_full_absorb_no_cap(): void
    {
        $result = $this->calc->calculate(PaymentMethod::Ewallet, 400_000);
        $this->assertSame(0.0, $result['customer_fee']);
        $this->assertSame(6000.0, $result['dombi_fee']);
        $this->assertSame(6000.0, $result['gateway_fee']);
    }

    public function test_above_threshold_customer_pays(): void
    {
        $result = $this->calc->calculate(PaymentMethod::Qris, 600_000);
        $this->assertSame(4200.0, $result['customer_fee']);
        $this->assertSame(0.0, $result['dombi_fee']);
        $this->assertSame(4200.0, $result['gateway_fee']);
    }

    public function test_cc_always_customer_below_threshold(): void
    {
        $result = $this->calc->calculate(PaymentMethod::CreditCard, 100_000);
        $this->assertSame(2900.0, $result['customer_fee']);
        $this->assertSame(0.0, $result['dombi_fee']);
    }

    public function test_cc_always_customer_above_threshold(): void
    {
        $result = $this->calc->calculate(PaymentMethod::CreditCard, 600_000);
        $this->assertSame(17400.0, $result['customer_fee']);
        $this->assertSame(0.0, $result['dombi_fee']);
    }

    public function test_exact_threshold_500k_customer_pays(): void
    {
        $result = $this->calc->calculate(PaymentMethod::Qris, 500_000);
        $this->assertSame(3500.0, $result['customer_fee']);
        $this->assertSame(0.0, $result['dombi_fee']);
    }

    public function test_transfer_below_threshold_full_absorb(): void
    {
        $result = $this->calc->calculate(PaymentMethod::Transfer, 200_000);
        $this->assertSame(0.0, $result['customer_fee']);
        $this->assertSame(800.0, $result['dombi_fee']);
    }

    public function test_subtotal_only_threshold_logic(): void
    {
        // 400k subtotal absorbed even if delivery would push total >=500k
        $result = $this->calc->calculate(PaymentMethod::Qris, 400_000);
        $this->assertSame(0.0, $result['customer_fee'], 'threshold must use subtotal only');
    }
}
