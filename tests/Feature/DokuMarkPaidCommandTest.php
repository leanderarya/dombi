<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
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
        $transaction = PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => 50000,
            'status' => 'pending',
        ]);
        PaymentAttempt::create([
            'order_id' => $order->id,
            'legacy_payment_transaction_id' => $transaction->id,
            'attempt_key' => 'mark-paid-attempt',
            'invoice_number' => $order->order_code,
            'merchant_request_id' => 'mark-paid-request',
            'amount_snapshot' => 50000,
            'currency_snapshot' => 'IDR',
            'creation_state' => 'unknown',
            'settlement_status' => 'pending',
            'verification_status' => 'needs_review',
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
