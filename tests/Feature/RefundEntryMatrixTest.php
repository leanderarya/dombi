<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\RefundStatusHistory;
use App\Models\User;
use App\Services\OrderStatusService;
use App\Services\RefundService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundEntryMatrixTest extends TestCase
{
    use RefreshDatabase;

    private OrderStatusService $service;
    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(OrderStatusService::class);
        $this->outlet = Outlet::factory()->create();
    }

    public function test_customer_cancellation_paid_triggers_refund(): void
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create()->id]);
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'outlet_id' => $this->outlet->id,
            'total' => 50000,
            'status' => 'pending_confirmation',
        ]);

        $this->service->cancelByCustomer($order, 'Salah Pesan', null);

        $order->refresh();
        $this->assertSame('refund_pending', $order->payment_status);
        $this->assertSame('customer_cancellation', $order->refund_reason);

        $history = RefundStatusHistory::where('order_id', $order->id)->first();
        $this->assertNotNull($history);
        $this->assertSame('refund_requested', $history->event);
        $this->assertEquals('customer_cancellation', $history->metadata['source_entry_point']);
    }

    public function test_customer_cancellation_pending_leaves_unchanged(): void
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create()->id]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'outlet_id' => $this->outlet->id,
            'total' => 50000,
            'status' => 'pending_confirmation',
            'payment_status' => 'pending',
        ]);

        $this->service->cancelByCustomer($order, 'Salah Pesan', null);

        $order->refresh();
        $this->assertSame('pending', $order->payment_status);
        $this->assertNull($order->refund_amount);
    }

    public function test_outlet_rejection_paid_triggers_refund(): void
    {
        $order = Order::factory()->paid()->create([
            'outlet_id' => $this->outlet->id,
            'total' => 50000,
            'status' => 'pending_confirmation',
        ]);
        $actor = User::factory()->create(['role' => 'outlet']);

        $this->service->rejectOrder($order, 'Stok Tidak Tersedia', null, $actor);

        $order->refresh();
        $this->assertSame('refund_pending', $order->payment_status);
        $this->assertSame('outlet_rejection', $order->refund_reason);

        $history = RefundStatusHistory::where('order_id', $order->id)->first();
        $this->assertNotNull($history);
        $this->assertEquals('outlet_rejection', $history->metadata['source_entry_point']);
    }

    public function test_outlet_cancellation_from_accepted_status_paid_triggers_refund(): void
    {
        $order = Order::factory()->paid()->create([
            'outlet_id' => $this->outlet->id,
            'total' => 50000,
            'status' => 'confirmed',
        ]);
        $actor = User::factory()->create(['role' => 'outlet']);

        $this->service->transition($order, 'cancelled_by_outlet', [
            'actor_id' => $actor->id,
            'actor_type' => 'outlet',
            'reason' => 'Stok Tidak Tersedia',
        ]);

        $order->refresh();
        $this->assertSame('refund_pending', $order->payment_status);
        $this->assertSame('outlet_cancellation', $order->refund_reason);
    }

    public function test_expiry_paid_triggers_refund(): void
    {
        $order = Order::factory()->paid()->create([
            'outlet_id' => $this->outlet->id,
            'total' => 50000,
            'status' => 'pending_confirmation',
        ]);

        $this->service->expireOrder($order, 'Confirmation timeout');

        $order->refresh();
        $this->assertSame('refund_pending', $order->payment_status);
        $this->assertSame('expiry', $order->refund_reason);
    }

    public function test_outlet_cancellation_reasons_contains_canonical_stock(): void
    {
        $reasons = OrderStatusService::outletCancellationReasons();
        $this->assertContains('Stok Tidak Tersedia', $reasons);
        $this->assertNotContains('Stok Habis', $reasons);
    }
}
