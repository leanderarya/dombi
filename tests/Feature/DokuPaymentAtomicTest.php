<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Outlet;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DokuPaymentAtomicTest extends TestCase
{
    use RefreshDatabase;

    public function test_mark_order_paid_is_idempotent_via_atomic_transition(): void
    {
        $order = Order::factory()->create([
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'payment_status' => 'pending',
            'outlet_id' => Outlet::factory()->create()->id,
        ]);
        $service = app(DokuService::class);
        $service->markOrderPaidPublic($order);
        $service->markOrderPaidPublic($order); // second call must be no-op
        $this->assertSame('paid', Order::find($order->id)->payment_status);
    }

    public function test_webhook_skips_terminal_status(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refunded']);
        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'SUCCESS'],
        ]);
        $this->assertSame('refunded', Order::find($order->id)->payment_status);
    }
}
