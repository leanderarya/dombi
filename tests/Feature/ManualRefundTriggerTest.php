<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Models\Outlet;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ManualRefundTriggerTest extends TestCase
{
    use RefreshDatabase;

    public function test_cancelling_a_paid_pending_confirmation_order_flags_refund_pending(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create([
            'customer_id' => $user->getCustomerOrCreate()->id,
            'outlet_id' => $outlet->id,
            'payment_status' => 'paid',
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'total' => 50000,
        ]);

        $this->actingAs($user)->post("/customer/orders/{$order->id}/cancel", [
            'reason' => 'Tidak Jadi Membeli',
        ]);

        $o = Order::find($order->id);
        $this->assertSame('refund_pending', $o->payment_status);
        $this->assertNotNull($o->refund_requested_at);
    }

    public function test_cannot_cancel_confirmed_order(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create([
            'customer_id' => $user->getCustomerOrCreate()->id,
            'outlet_id' => $outlet->id,
            'payment_status' => 'paid',
            'status' => Order::STATUS_CONFIRMED,
            'total' => 50000,
        ]);

        $this->actingAs($user)->post("/customer/orders/{$order->id}/cancel", [
            'reason' => 'Tidak Jadi Membeli',
        ])->assertSessionHasErrors();

        $this->assertSame('paid', Order::find($order->id)->payment_status);
    }

    public function test_cannot_cancel_preparing_order(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create([
            'customer_id' => $user->getCustomerOrCreate()->id,
            'outlet_id' => $outlet->id,
            'payment_status' => 'paid',
            'status' => Order::STATUS_PREPARING,
            'total' => 50000,
        ]);

        $this->actingAs($user)->post("/customer/orders/{$order->id}/cancel", [
            'reason' => 'Tidak Jadi Membeli',
        ])->assertSessionHasErrors();

        $this->assertSame('paid', Order::find($order->id)->payment_status);
    }
}
