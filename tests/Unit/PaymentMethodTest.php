<?php

namespace Tests\Unit;

use App\Enums\PaymentMethod;
use PHPUnit\Framework\TestCase;

class PaymentMethodTest extends TestCase
{
    public function test_has_four_core_methods(): void
    {
        $values = array_map(fn ($c) => $c->value, PaymentMethod::cases());
        $this->assertContains('qris', $values);
        $this->assertContains('ewallet', $values);
        $this->assertContains('transfer', $values);
        $this->assertContains('credit_card', $values);
    }

    public function test_fee_category_grouping(): void
    {
        $this->assertTrue(PaymentMethod::Qris->isAbsorbable());
        $this->assertTrue(PaymentMethod::Transfer->isAbsorbable());
        $this->assertTrue(PaymentMethod::Ewallet->isAbsorbable());
        $this->assertFalse(PaymentMethod::CreditCard->isAbsorbable());
    }

    public function test_legacy_aliases_normalize(): void
    {
        $this->assertSame(PaymentMethod::Ewallet, PaymentMethod::Gopay->normalized());
        $this->assertSame(PaymentMethod::Ewallet, PaymentMethod::Shopeepay->normalized());
        $this->assertSame(PaymentMethod::Ewallet, PaymentMethod::Dana->normalized());
    }

    public function test_doku_type_mapping(): void
    {
        $this->assertSame('QRIS', PaymentMethod::Qris->dokuType());
        $this->assertSame('VA', PaymentMethod::Transfer->dokuType());
        $this->assertSame('CREDIT_CARD', PaymentMethod::CreditCard->dokuType());
        $this->assertSame('EWALLET', PaymentMethod::Ewallet->dokuType());
    }
}
