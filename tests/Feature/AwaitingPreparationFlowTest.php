<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\PaymentAttempt;
use App\Models\User;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AwaitingPreparationFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_outlet_can_start_preparing_a_paid_order(): void
    {
        [$order, $outletUser] = $this->paidOrder();

        app(OrderStatusService::class)->transition($order, Order::STATUS_PREPARING, [
            'actor_id' => $outletUser->id,
            'actor_type' => 'outlet',
        ]);

        $this->assertSame(Order::STATUS_PREPARING, $order->fresh()->status);
    }

    public function test_preparation_cannot_jump_straight_to_completed(): void
    {
        $service = app(OrderStatusService::class);

        $this->assertFalse($service->canTransition(Order::STATUS_AWAITING_PREPARATION, Order::STATUS_COMPLETED));
        $this->assertTrue($service->canTransition(Order::STATUS_AWAITING_PREPARATION, Order::STATUS_PREPARING));
    }

    public function test_customer_can_cancel_while_awaiting_preparation_and_refund_is_flagged(): void
    {
        [$order, , $customer] = $this->paidOrder();

        $this->actingAs($customer)
            ->post("/customer/orders/{$order->id}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $order->refresh();
        $this->assertSame(Order::STATUS_CANCELLED_BY_CUSTOMER, $order->status);
        $this->assertSame('refund_pending', $order->payment_status);
        $this->assertSame('customer_cancellation', $order->refund_reason);
    }

    public function test_customer_cannot_cancel_once_preparing_has_started(): void
    {
        [$order, $outletUser, $customer] = $this->paidOrder();

        app(OrderStatusService::class)->transition($order, Order::STATUS_PREPARING, [
            'actor_id' => $outletUser->id,
            'actor_type' => 'outlet',
        ]);

        $this->actingAs($customer)
            ->post("/customer/orders/{$order->id}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ])
            ->assertSessionHasErrors('status');

        $this->assertSame(Order::STATUS_PREPARING, $order->fresh()->status);
    }

    public function test_outlet_cancellation_from_awaiting_preparation_flags_a_refund(): void
    {
        [$order, $outletUser] = $this->paidOrder();

        app(OrderStatusService::class)->transition($order, Order::STATUS_CANCELLED_BY_OUTLET, [
            'actor_id' => $outletUser->id,
            'actor_type' => 'outlet',
            'reason' => 'Stok Tidak Tersedia',
        ]);

        $order->refresh();
        $this->assertSame(Order::STATUS_CANCELLED_BY_OUTLET, $order->status);
        $this->assertSame('refund_pending', $order->payment_status);
        $this->assertSame('outlet_cancellation', $order->refund_reason);
    }

    public function test_backfill_moves_only_the_paid_orders(): void
    {
        [$paid] = $this->paidOrder(status: Order::STATUS_PENDING_CONFIRMATION);
        [$unpaid] = $this->paidOrder(status: Order::STATUS_PENDING_CONFIRMATION, paymentStatus: 'pending');

        $this->artisan('orders:backfill-awaiting-preparation')->assertSuccessful();

        $this->assertSame(Order::STATUS_AWAITING_PREPARATION, $paid->fresh()->status);
        $this->assertSame(Order::STATUS_PENDING_CONFIRMATION, $unpaid->fresh()->status);
    }

    /**
     * @return array{0: Order, 1: User, 2: User}
     */
    private function paidOrder(
        string $status = Order::STATUS_AWAITING_PREPARATION,
        string $paymentStatus = 'paid',
    ): array {
        $customer = User::factory()->create(['role' => 'customer']);
        $outlet = Outlet::factory()->create();
        $outletUser = User::factory()->create(['role' => 'outlet']);
        $order = Order::factory()->create([
            'customer_id' => $customer->getCustomerOrCreate()->id,
            'outlet_id' => $outlet->id,
            'status' => $status,
            'payment_status' => $paymentStatus,
            'payment_method' => 'qris',
            'total' => 50000,
        ]);

        if ($paymentStatus !== 'paid') {
            return [$order, $outletUser, $customer];
        }

        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'test-'.$order->id,
            'invoice_number' => 'test-'.$order->id,
            'merchant_request_id' => 'test-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'verification_status' => 'verified',
            'settlement_status' => 'paid',
        ]);

        DB::table('payment_transactions')->insert([
            'order_id' => $order->id,
            'doku_order_id' => $order->doku_order_id ?? 'test-'.$order->id,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'paid',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [$order, $outletUser, $customer];
    }
}
