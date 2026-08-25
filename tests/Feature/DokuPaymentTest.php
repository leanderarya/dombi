<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use App\Services\DokuService;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DokuPaymentTest extends TestCase
{
    use RefreshDatabase;

    private DokuService $doku;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(NotificationService::class, function ($mock) {
            $mock->shouldReceive('notifyOrderConfirmed')->andReturnNull();
            $mock->shouldReceive('notifyOrderCreated')->andReturnNull();
        });

        config([
            'doku.client_id' => 'test-client',
            'doku.api_key' => 'test-key',
            'doku.base_url' => 'https://api-sandbox.doku.com',
        ]);

        $this->doku = app(DokuService::class);
    }

    public function test_create_payment_does_not_write_legacy_transaction_after_cutover(): void
    {
        config(['doku.legacy_writes_enabled' => false]);
        $order = Order::factory()->create(['total' => 50000, 'payment_status' => 'pending']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'cutover-'.$order->id,
            'invoice_number' => 'CUTOVER-001', 'merchant_request_id' => 'cutover-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);
        Http::fake(['*/checkout/v1/payment' => Http::response(['response' => ['payment' => ['url' => 'https://doku.test/pay']]], 200)]);

        $this->doku->createPayment($attempt);

        $this->assertDatabaseMissing('payment_transactions', ['doku_order_id' => 'CUTOVER-001']);
    }

    public function test_create_payment_returns_url(): void
    {
        $order = Order::factory()->create([
            'total' => 50000,
            'order_code' => 'INV-001',
            'customer_name' => 'Test Customer',
            'payment_status' => 'pending',
        ]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'create-'.$order->id,
            'invoice_number' => 'INV-001', 'merchant_request_id' => 'create-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);

        Http::fake([
            '*/checkout/v1/payment' => Http::response([
                'response' => [
                    'order' => ['session_id' => 'sess-123'],
                    'payment' => ['url' => 'https://sandbox.doku.com/pay/abc123'],
                ],
            ], 200),
        ]);

        $url = $this->doku->createPayment($attempt);

        $this->assertEquals('https://sandbox.doku.com/pay/abc123', $url);
        $this->assertNull($order->fresh()->doku_order_id);
        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertDatabaseMissing('payment_transactions', [
            'order_id' => $order->id,
            'doku_order_id' => 'INV-001',
        ]);
    }

    public function test_webhook_success_marks_paid_from_canonical_attempt_without_legacy_transaction(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'webhook-'.$order->id,
            'invoice_number' => 'INV-001',
            'merchant_request_id' => 'webhook-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
        ]);

        $payload = [
            'order' => ['invoice_number' => 'INV-001'],
            'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total],
        ];

        $this->doku->handleWebhook($payload);

        $this->assertEquals('paid', $order->fresh()->payment_status);
        $this->assertNotNull($order->fresh()->paid_at);
        $this->assertDatabaseCount('payment_transactions', 0);
        $this->assertDatabaseHas('payment_attempts', [
            'invoice_number' => 'INV-001',
            'settlement_status' => 'paid',
        ]);
    }

    public function test_webhook_success_marks_paid(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'INV-001',
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'webhook-'.$order->id,
            'invoice_number' => 'INV-001',
            'merchant_request_id' => 'webhook-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
        ]);

        $payload = [
            'order' => ['invoice_number' => 'INV-001'],
            'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total],
        ];

        $this->doku->handleWebhook($payload);

        $this->assertEquals('paid', $order->fresh()->payment_status);
        $this->assertNotNull($order->fresh()->paid_at);
    }

    public function test_webhook_invalid_signature_rejected(): void
    {
        $response = $this->postJson('/payment/doku/notify', [
            'order' => ['invoice_number' => 'INV-001'],
            'transaction' => ['status' => 'SUCCESS'],
            'signature' => 'invalid',
        ], [
            'Request-Id' => 'test-123',
        ]);

        $response->assertStatus(401);
    }

    public function test_webhook_idempotent(): void
    {
        $order = Order::factory()->create(['payment_status' => 'paid']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'INV-001',
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'paid',
        ]);

        $payload = [
            'order' => ['invoice_number' => 'INV-001'],
            'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total],
        ];

        $this->doku->handleWebhook($payload);

        $this->assertEquals('paid', $order->fresh()->payment_status);
    }

    public function test_status_mapping(): void
    {
        $this->assertEquals('paid', $this->doku->mapStatus('SUCCESS'));
        $this->assertEquals('pending', $this->doku->mapStatus('PENDING'));
        $this->assertEquals('failed', $this->doku->mapStatus('FAILED'));
        $this->assertEquals('expired', $this->doku->mapStatus('EXPIRED'));
        $this->assertEquals('unknown', $this->doku->mapStatus('UNKNOWN'));
    }

    public function test_redirect_ignores_unsigned_success_status(): void
    {
        $order = Order::factory()->create([
            'order_code' => 'INV-001',
            'payment_status' => 'pending',
        ]);

        Http::fake([
            '*/orders/v1/status/*' => Http::response(null, 500),
        ]);

        $response = $this->get('/payment/doku/redirect?invoice_number=INV-001&status=SUCCESS');

        $response->assertSessionHas('error', 'Status pembayaran belum dapat diverifikasi.');
        $this->assertEquals('pending', $order->fresh()->payment_status);
    }

    public function test_redirect_ignores_unsigned_failed_status(): void
    {
        $order = Order::factory()->create([
            'order_code' => 'INV-002',
            'payment_status' => 'pending',
        ]);

        Http::fake([
            '*/orders/v1/status/*' => Http::response(null, 500),
        ]);

        $response = $this->get('/payment/doku/redirect?invoice_number=INV-002&status=FAILED');

        $response->assertSessionHas('error', 'Status pembayaran belum dapat diverifikasi.');
        $this->assertEquals('pending', $order->fresh()->payment_status);
    }

    public function test_redirect_proceeds_on_verified_status_api(): void
    {
        $order = Order::factory()->create([
            'order_code' => 'INV-003',
            'doku_order_id' => 'INV-003',
            'payment_status' => 'pending',
        ]);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'INV-003',
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'redirect-'.$order->id,
            'invoice_number' => 'INV-003',
            'merchant_request_id' => 'redirect-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
        ]);

        Http::fake([
            '*/checkout/v1/payment/INV-003' => Http::response([
                'order' => ['invoice_number' => 'INV-003'],
                'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total],
            ], 200),
        ]);

        $response = $this->get('/payment/doku/redirect?invoice_number=INV-003&status=SUCCESS');

        $response->assertRedirect();
        $this->assertEquals('paid', $order->fresh()->payment_status);
        $this->assertNotNull($order->fresh()->paid_at);
    }
}
