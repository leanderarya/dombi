<?php

namespace Tests\Feature;

use App\Models\Order;
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

    public function test_create_payment_returns_url(): void
    {
        $order = Order::factory()->create([
            'total' => 50000,
            'order_code' => 'INV-001',
            'customer_name' => 'Test Customer',
            'payment_status' => 'pending',
        ]);

        Http::fake([
            '*/checkout/v1/payment' => Http::response([
                'response' => [
                    'order' => ['session_id' => 'sess-123'],
                    'payment' => ['url' => 'https://sandbox.doku.com/pay/abc123'],
                ],
            ], 200),
        ]);

        $url = $this->doku->createPayment($order);

        $this->assertEquals('https://sandbox.doku.com/pay/abc123', $url);
        $this->assertEquals('INV-001', $order->fresh()->doku_order_id);
        $this->assertEquals('pending', $order->fresh()->payment_status);
        $this->assertDatabaseHas('payment_transactions', [
            'order_id' => $order->id,
            'doku_order_id' => 'INV-001',
            'status' => 'pending',
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

        $payload = [
            'order' => ['invoice_number' => 'INV-001'],
            'transaction' => ['status' => 'SUCCESS'],
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
            'transaction' => ['status' => 'SUCCESS'],
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
        $this->assertEquals('pending', $this->doku->mapStatus('UNKNOWN'));
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

        Http::fake([
            '*/checkout/v1/payment/INV-003' => Http::response([
                'order' => ['invoice_number' => 'INV-003'],
                'transaction' => ['status' => 'SUCCESS'],
            ], 200),
        ]);

        $response = $this->get('/payment/doku/redirect?invoice_number=INV-003&status=SUCCESS');

        $response->assertRedirect();
        $this->assertEquals('paid', $order->fresh()->payment_status);
        $this->assertNotNull($order->fresh()->paid_at);
    }
}
