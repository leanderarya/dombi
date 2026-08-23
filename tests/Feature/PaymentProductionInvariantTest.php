<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Models\RefundStatusHistory;
use App\Services\DokuService;
use App\Services\NotificationService;
use App\Services\RefundService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
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
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'SUCCESS', 'amount' => 10000],
        ]);

        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertSame('pending', PaymentTransaction::where('order_id', $order->id)->sole()->status);
        $this->assertDatabaseCount('refund_status_histories', 0);
    }

    public function test_order_payment_status_projects_from_successful_attempt_state(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $transaction = PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        $transaction->update(['status' => 'paid']);

        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_duplicate_payment_retry_creation_keeps_single_attempt_for_same_invoice(): void
    {
        $order = Order::factory()->create(['order_code' => 'INV-RETRY', 'payment_status' => 'pending']);
        Http::fake([
            '*/checkout/v1/payment' => Http::response([
                'response' => [
                    'order' => ['session_id' => 'sess-retry'],
                    'payment' => ['url' => 'https://sandbox.doku.com/pay/retry'],
                ],
            ]),
        ]);

        $service = app(DokuService::class);
        $service->createPayment($order);

        try {
            $service->createPayment($order->fresh());
        } catch (\Throwable) {
            $this->fail('Duplicate retry creation must be idempotent, not fail with a database exception.');
        }

        $this->assertSame(1, PaymentTransaction::where('doku_order_id', 'INV-RETRY')->count());
    }

    public function test_invoice_without_canonical_attempt_cannot_settle_order(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);

        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => 'INV-NO-ATTEMPT'],
            'transaction' => ['status' => 'SUCCESS'],
        ]);

        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertDatabaseMissing('payment_transactions', ['doku_order_id' => 'INV-NO-ATTEMPT']);
    }

    public function test_duplicate_late_success_webhooks_create_one_refund_obligation_for_attempt(): void
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
            'amount' => $order->total,
            'status' => 'pending',
        ]);
        $payload = [
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'SUCCESS', 'amount' => 50000],
        ];
        $service = app(DokuService::class);
        $service->handleWebhook($payload);
        $service->handleWebhook($payload);

        $this->assertSame('refund_pending', $order->fresh()->payment_status);
        $this->assertSame(1, RefundStatusHistory::where('order_id', $order->id)
            ->where('event', 'refund_requested')
            ->whereJsonContains('metadata->source_entry_point', 'late_payment')
            ->count(), 'Future canonical obligation identity must be (payment_attempt_id, reason); current schema proxy uses order history metadata.');
        $this->assertSame(1, PaymentTransaction::where('order_id', $order->id)->where('status', 'paid')->count());
    }

    public function test_duplicate_refund_request_returns_null_without_second_obligation(): void
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
        $first = $service->request($order, 'system', null, 'late_payment');
        $second = $service->request($order->fresh(), 'system', null, 'late_payment');

        $this->assertNotNull($first);
        $this->assertNull($second);
        $this->assertSame(1, RefundStatusHistory::where('order_id', $order->id)
            ->where('event', 'refund_requested')
            ->where('reason_code', 'late_payment')
            ->count(), 'Current observable proxy for future canonical obligation identity: (payment_attempt_id, reason).');
    }

    public function test_paid_order_cannot_regress_on_late_failure(): void
    {
        $order = Order::factory()->create(['payment_status' => 'paid']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $order->order_code,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'paid',
        ]);

        app(DokuService::class)->handleWebhook([
            'order' => ['invoice_number' => $order->order_code],
            'transaction' => ['status' => 'FAILED'],
        ]);

        $this->assertSame('paid', $order->fresh()->payment_status);
    }
}
