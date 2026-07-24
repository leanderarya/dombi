<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Models\Outlet;
use App\Services\RefundService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class DokuMarkPaidCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_pending_terminal_order_reaches_refund_pending(): void
    {
        $order = Order::factory()->create([
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => 'pending',
            'total' => 50000,
        ]);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => 50000,
            'status' => 'pending',
        ]);

        $exit = Artisan::call('doku:mark-paid', ['order_code' => $order->order_code]);

        $this->assertSame(0, $exit);
        $order->refresh();
        $this->assertSame('refund_pending', $order->payment_status);
    }

    public function test_existing_refund_status_rejected(): void
    {
        $order = Order::factory()->create([
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => 'refund_pending',
        ]);

        $exit = Artisan::call('doku:mark-paid', ['order_code' => $order->order_code]);

        $this->assertSame(1, $exit);
        $this->assertStringContainsString('tidak dapat ditandai paid', Artisan::output());
    }
}
