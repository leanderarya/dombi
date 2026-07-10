<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Order;
use App\Models\User;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class RefundFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_cancel_paid_order_triggers_refund(): void
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

        $dokuMock = Mockery::mock(DokuService::class);
        $dokuMock->shouldReceive('refund')
            ->once()
            ->andReturnUsing(function (Order $order, string $reason) {
                $order->update([
                    'payment_status' => 'refunded',
                    'refunded_at' => now(),
                    'refund_amount' => $order->total,
                    'refund_reason' => $reason,
                    'doku_refund_id' => 'REF-' . $order->order_code,
                ]);

                return ['status' => 'success', 'refund_id' => 'REF-' . $order->order_code];
            });
        $this->app->instance(DokuService::class, $dokuMock);

        $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $order->refresh();
        $this->assertEquals('cancelled_by_customer', $order->status);
        $this->assertEquals('refunded', $order->payment_status);
        $this->assertNotNull($order->refunded_at);
        $this->assertEquals(50000, $order->refund_amount);
    }

    public function test_refund_failed_sets_refund_failed_status(): void
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

        $dokuMock = Mockery::mock(DokuService::class);
        $dokuMock->shouldReceive('refund')
            ->once()
            ->andReturnUsing(function (Order $order) {
                $order->update([
                    'payment_status' => 'refund_failed',
                    'refund_reason' => 'DOKU error',
                ]);

                return ['status' => 'failed', 'error' => 'DOKU error'];
            });
        $this->app->instance(DokuService::class, $dokuMock);

        $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $order->refresh();
        $this->assertEquals('cancelled_by_customer', $order->status);
        $this->assertEquals('refund_failed', $order->payment_status);
    }

    public function test_already_refunded_is_idempotent(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'refunded',
            'payment_method' => 'qris',
        ]);

        $dokuService = app(DokuService::class);
        $result = $dokuService->refund($order, 'test');

        $this->assertEquals('already_refunded', $result['status']);
    }

    public function test_cash_order_skips_refund(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'paid',
            'payment_method' => 'cash',
        ]);

        $dokuService = app(DokuService::class);
        $result = $dokuService->refund($order, 'test');

        $this->assertEquals('skipped', $result['status']);
    }

    public function test_unpaid_order_skips_refund(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'pending',
            'payment_method' => 'qris',
        ]);

        $dokuService = app(DokuService::class);
        $result = $dokuService->refund($order, 'test');

        $this->assertEquals('skipped', $result['status']);
    }
}
