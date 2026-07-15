<?php

namespace Tests\Unit;

use App\Enums\PaymentStatus;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderPaymentStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_status_enum_accessor_returns_enum(): void
    {
        $order = Order::factory()->create(['payment_status' => 'paid']);
        $this->assertSame(PaymentStatus::Paid, $order->payment_status_enum);
    }

    public function test_refundable_scope_returns_paid_and_refund_pending_only(): void
    {
        Order::factory()->create(['payment_status' => 'paid']);
        Order::factory()->create(['payment_status' => 'refund_pending']);
        Order::factory()->create(['payment_status' => 'refunded']);
        Order::factory()->create(['payment_status' => 'pending']);
        $this->assertSame(2, Order::refundable()->count());
    }
}
