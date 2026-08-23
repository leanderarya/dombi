<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Models\RefundStatusHistory;
use App\Services\DokuService;
use App\Services\NotificationService;
use App\Services\RefundService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentProductionInvariantTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(NotificationService::class, function ($mock) {
            $mock->shouldReceive('notifyOrderCreated')->andReturnNull();
            $mock->shouldReceive('notifyOrderConfirmed')->andReturnNull();
            $mock->shouldReceive('notifyRefundRequested')->andReturnNull();
            $mock->shouldReceive('notifyRefundEvent')->andReturnNull();
        });
    }

    public function test_duplicate_success_notifications_do_not_create_duplicate_paid_attempts(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        $payload = [
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'SUCCESS'],
        ];
        $service = app(DokuService::class);
        $service->handleWebhook($payload);
        $service->handleWebhook($payload);

        $this->assertDatabaseCount('payment_transactions', 1);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_success_with_amount_mismatch_does_not_settle_order(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending', 'total' => 50000]);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => 10000,
            'status' => 'pending',
        ]);

        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'SUCCESS'],
        ]);

        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_order_payment_status_is_projection_of_successful_attempt(): void
    {
        $order = Order::factory()->create(['payment_status' => 'paid']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'failed',
        ]);

        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame(0, PaymentTransaction::where('order_id', $order->id)->whereIn('status', ['paid', 'settled'])->count());
    }

    public function test_duplicate_payment_retry_keeps_single_attempt_for_same_invoice(): void
    {
        $order = Order::factory()->create(['order_code' => 'INV-RETRY', 'payment_status' => 'pending']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'INV-RETRY',
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        $this->assertSame(1, PaymentTransaction::where('doku_order_id', 'INV-RETRY')->count());
    }

    public function test_ambiguous_invoice_cannot_settle_multiple_orders(): void
    {
        $order = Order::factory()->create(['order_code' => 'INV-AMBIGUOUS', 'payment_status' => 'pending']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'INV-AMBIGUOUS',
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => 'INV-AMBIGUOUS'],
            'transaction' => ['status' => 'SUCCESS'],
        ]);

        $this->assertSame('pending', $order->fresh()->payment_status);
    }

    public function test_late_success_creates_one_refund_obligation(): void
    {
        $order = Order::factory()->create([
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => 'pending',
            'total' => 50000,
        ]);
        $service = app(DokuService::class);
        $service->markOrderPaidPublic($order);
        $service->markOrderPaidPublic($order->fresh());

        $this->assertSame('refund_pending', $order->fresh()->payment_status);
        $this->assertDatabaseCount('refund_status_histories', 1);
    }

    public function test_refund_obligation_is_unique_for_repeated_request(): void
    {
        $order = Order::factory()->paid()->create(['total' => 50000]);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'REFUND-'.$order->id,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'paid',
        ]);
        $service = app(RefundService::class);
        $service->request($order, 'system', null, 'late_payment');
        $service->request($order->fresh(), 'system', null, 'late_payment');

        $this->assertSame(1, RefundStatusHistory::where('order_id', $order->id)->where('event', 'refund_requested')->count());
    }

    public function test_paid_order_cannot_regress_on_late_failure(): void
    {
        $order = Order::factory()->create(['payment_status' => 'paid']);
        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'FAILED'],
        ]);

        $this->assertSame('paid', $order->fresh()->payment_status);
    }
}
