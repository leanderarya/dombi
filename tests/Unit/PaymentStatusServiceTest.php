<?php

namespace Tests\Unit;

use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Services\PaymentStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentStatusServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_transition_applies_only_when_current_status_matches(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::Paid, ['paid_at' => now()]);
        $this->assertTrue($ok);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'payment_status' => 'paid']);
    }

    public function test_transition_is_no_op_when_current_status_differs(): void
    {
        $order = Order::factory()->create(['payment_status' => 'paid']);
        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::Pending);
        $this->assertFalse($ok);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'payment_status' => 'paid']);
    }

    public function test_cannot_transition_a_terminal_status(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refunded']);
        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::Pending);
        $this->assertFalse($ok);
    }
}
