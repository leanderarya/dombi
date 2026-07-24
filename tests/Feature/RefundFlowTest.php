<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Models\Outlet;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RefundFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_cancel_paid_pending_confirmation_order_flags_refund_pending(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create([
            'customer_id' => $user->getCustomerOrCreate()->id,
            'outlet_id' => $outlet->id,
            'status' => 'pending_confirmation',
            'payment_status' => 'paid',
            'payment_method' => 'qris',
            'total' => 50000,
        ]);

        DB::table('payment_transactions')->insert([
            'order_id' => $order->id,
            'doku_order_id' => $order->doku_order_id ?? 'test-'.$order->id,
            'payment_method' => $order->payment_method ?? 'qris',
            'amount' => $order->total,
            'status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $order->refresh();
        $this->assertSame('cancelled_by_customer', $order->status);
        $this->assertSame('refund_pending', $order->payment_status);
        $this->assertSame($order->total, $order->refund_amount);
        $this->assertNotNull($order->refund_requested_at);
    }

    public function test_cancel_unpaid_pending_confirmation_order_no_refund(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create([
            'customer_id' => $user->getCustomerOrCreate()->id,
            'outlet_id' => $outlet->id,
            'status' => 'pending_confirmation',
            'payment_status' => 'pending',
            'payment_method' => 'qris',
            'total' => 50000,
        ]);

        $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $order->refresh();
        $this->assertSame('cancelled_by_customer', $order->status);
        $this->assertSame('pending', $order->payment_status);
        $this->assertNull($order->refund_requested_at);
    }

    public function test_cannot_cancel_confirmed_order(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create([
            'customer_id' => $user->getCustomerOrCreate()->id,
            'outlet_id' => $outlet->id,
            'status' => 'confirmed',
            'payment_status' => 'paid',
            'payment_method' => 'qris',
            'total' => 50000,
        ]);

        $response = $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $response->assertSessionHasErrors();
        $order->refresh();
        $this->assertSame('confirmed', $order->status);
        $this->assertSame('paid', $order->payment_status);
    }

    public function test_cannot_cancel_preparing_order(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create([
            'customer_id' => $user->getCustomerOrCreate()->id,
            'outlet_id' => $outlet->id,
            'status' => 'preparing',
            'payment_status' => 'paid',
            'payment_method' => 'qris',
            'total' => 50000,
        ]);

        $response = $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $response->assertSessionHasErrors();
        $order->refresh();
        $this->assertSame('preparing', $order->status);
    }

    public function test_refund_pending_is_idempotent(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refund_pending']);

        $this->assertSame('refund_pending', $order->payment_status);
    }

    public function test_reject_paid_order_creates_refund_pending(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'status' => 'pending_confirmation',
            'payment_status' => 'paid',
            'total' => 75000,
        ]);

        DB::table('payment_transactions')->insert([
            'order_id' => $order->id,
            'doku_order_id' => $order->doku_order_id ?? 'test-'.$order->id,
            'payment_method' => $order->payment_method ?? 'qris',
            'amount' => $order->total,
            'status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($user)
            ->post("/outlet/orders/{$order->id}/reject", [
                'reason' => 'Stok Tidak Tersedia',
            ]);

        $order->refresh();
        $this->assertSame('rejected_by_outlet', $order->status);
        $this->assertSame('refund_pending', $order->payment_status);
        $this->assertSame(75000, (int) $order->refund_amount);
        $this->assertNotNull($order->refund_requested_at);
    }

    public function test_reject_unpaid_order_does_not_create_refund(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'status' => 'pending_confirmation',
            'payment_status' => 'pending',
            'total' => 75000,
        ]);

        $this->actingAs($user)
            ->post("/outlet/orders/{$order->id}/reject", [
                'reason' => 'Stok Tidak Tersedia',
            ]);

        $order->refresh();
        $this->assertSame('rejected_by_outlet', $order->status);
        $this->assertSame('pending', $order->payment_status);
        $this->assertNull($order->refund_amount);
        $this->assertNull($order->refund_requested_at);
    }
}
