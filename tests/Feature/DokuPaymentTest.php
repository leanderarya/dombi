<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use App\Models\PaymentWebhookLog;
use App\Services\DokuService;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DokuPaymentTest extends TestCase
{
    use RefreshDatabase;

    private DokuService $doku;

    private function newInvoice(string $hex = 'A'): string
    {
        return 'DMB1'.str_repeat($hex, 24);
    }

    private function createAttemptForInvoice(Order $order, string $invoice): PaymentAttempt
    {
        $suffix = bin2hex(random_bytes(8));

        return PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'test-'.$suffix,
            'invoice_number' => $invoice,
            'merchant_request_id' => 'test-request-'.$suffix,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'creation_state' => 'created',
        ]);
    }

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

        $this->assertDatabaseHas('payment_attempts', [
            'id' => $attempt->id,
            'creation_state' => 'created',
            'invoice_number' => 'CUTOVER-001',
        ]);
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
        Http::assertSent(fn ($request) => $request->url() === 'https://api-sandbox.doku.com/checkout/v1/payment'
            && $request['order']['invoice_number'] === 'INV-001');
        $this->assertDatabaseHas('payment_attempts', [
            'id' => $attempt->id,
            'creation_state' => 'created',
            'invoice_number' => 'INV-001',
        ]);
        $this->assertNull($order->fresh()->doku_order_id);
        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertDatabaseMissing('payment_transactions', [
            'order_id' => $order->id,
            'doku_order_id' => 'INV-001',
        ]);
    }

    public function test_create_payment_points_browser_callbacks_at_redirect_handler(): void
    {
        $order = Order::factory()->create([
            'total' => 50000,
            'order_code' => 'INV-CB',
            'payment_status' => 'pending',
        ]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'callback-'.$order->id,
            'invoice_number' => 'INV-CB', 'merchant_request_id' => 'callback-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);

        Http::fake([
            '*/checkout/v1/payment' => Http::response([
                'response' => ['payment' => ['url' => 'https://sandbox.doku.com/pay/cb']],
            ], 200),
        ]);

        $this->doku->createPayment($attempt);

        $expected = route('doku.redirect', ['invoice_number' => 'INV-CB']);
        $webhook = route('doku.notify');

        Http::assertSent(fn ($request) => $request->url() === 'https://api-sandbox.doku.com/checkout/v1/payment'
            && $request['order']['callback_url'] === $expected
            && $request['order']['callback_url_result'] === $expected);

        // Both callbacks are browser-facing ("Back to Merchant"). Pointing either
        // of them at the JSON webhook endpoint strands the customer on
        // {"message":"OK"} after paying, before polling can redirect in-app.
        Http::assertNotSent(fn ($request) => in_array($request['order']['callback_url'] ?? null, [$webhook], true)
            || in_array($request['order']['callback_url_result'] ?? null, [$webhook], true));
    }

    public function test_create_payment_honours_configured_auto_redirect(): void
    {
        config(['doku.auto_redirect' => false]);

        $order = Order::factory()->create([
            'total' => 50000,
            'order_code' => 'INV-AR',
            'payment_status' => 'pending',
        ]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'autoredirect-'.$order->id,
            'invoice_number' => 'INV-AR', 'merchant_request_id' => 'autoredirect-request-'.$order->id,
            'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR',
        ]);

        Http::fake([
            '*/checkout/v1/payment' => Http::response([
                'response' => ['payment' => ['url' => 'https://sandbox.doku.com/pay/ar']],
            ], 200),
        ]);

        $this->doku->createPayment($attempt);

        Http::assertSent(fn ($request) => $request->url() === 'https://api-sandbox.doku.com/checkout/v1/payment'
            && $request['order']['auto_redirect'] === false);
    }

    public function test_webhook_success_marks_paid_from_canonical_attempt_without_legacy_transaction(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $invoice = $this->newInvoice();
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'webhook-'.$order->id,
            'invoice_number' => $invoice,
            'merchant_request_id' => 'webhook-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
        ]);

        $payload = [
            'order' => ['invoice_number' => $invoice],
            'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total],
        ];

        $this->doku->handleWebhook($payload);

        $this->assertEquals('paid', $order->fresh()->payment_status);
        $this->assertNotNull($order->fresh()->paid_at);
        $this->assertDatabaseCount('payment_transactions', 0);
        $this->assertDatabaseHas('payment_attempts', [
            'invoice_number' => $invoice,
            'settlement_status' => 'paid',
        ]);
    }

    public function test_webhook_rejects_attempt_when_invoice_belongs_to_different_order(): void
    {
        $attemptOrder = Order::factory()->create(['payment_status' => 'pending']);
        $invoice = $this->newInvoice('B');
        $invoiceOrder = Order::factory()->create(['doku_order_id' => $invoice, 'payment_status' => 'pending']);
        PaymentAttempt::create([
            'order_id' => $attemptOrder->id,
            'attempt_key' => 'mismatch-'.$attemptOrder->id,
            'invoice_number' => $invoice,
            'merchant_request_id' => 'mismatch-request-'.$attemptOrder->id,
            'amount_snapshot' => $attemptOrder->total,
            'currency_snapshot' => 'IDR',
        ]);

        $this->doku->handleWebhook([
            'order' => ['invoice_number' => $invoice],
            'transaction' => ['status' => 'SUCCESS', 'amount' => $attemptOrder->total],
        ]);

        $this->assertEquals('pending', $attemptOrder->fresh()->payment_status);
        $this->assertEquals('pending', $invoiceOrder->fresh()->payment_status);
        $this->assertDatabaseHas('payment_webhook_logs', [
            'invoice_number' => $invoice,
            'error' => 'invoice_order_attempt_mismatch',
        ]);
    }

    public function test_webhook_success_marks_paid(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $invoice = $this->newInvoice('C');
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $invoice,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'webhook-'.$order->id,
            'invoice_number' => $invoice,
            'merchant_request_id' => 'webhook-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
        ]);

        $payload = [
            'order' => ['invoice_number' => $invoice],
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
        $invoice = $this->newInvoice('D');
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $invoice,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'paid',
        ]);

        $payload = [
            'order' => ['invoice_number' => $invoice],
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
        $invoice = $this->newInvoice();
        $order = Order::factory()->create([
            'payment_status' => 'pending',
        ]);
        $this->createAttemptForInvoice($order, $invoice);

        Http::fake([
            '*/orders/v1/status/*' => Http::response(null, 500),
        ]);

        $response = $this->get('/payment/doku/redirect?invoice_number='.$invoice.'&status=SUCCESS');

        $response->assertSessionHas('error', 'Status pembayaran belum dapat diverifikasi.');
        $this->assertEquals('pending', $order->fresh()->payment_status);
    }

    public function test_redirect_ignores_unsigned_failed_status(): void
    {
        $invoice = $this->newInvoice('B');
        $order = Order::factory()->create([
            'payment_status' => 'pending',
        ]);
        $this->createAttemptForInvoice($order, $invoice);

        Http::fake([
            '*/orders/v1/status/*' => Http::response(null, 500),
        ]);

        $response = $this->get('/payment/doku/redirect?invoice_number='.$invoice.'&status=FAILED');

        $response->assertSessionHas('error', 'Status pembayaran belum dapat diverifikasi.');
        $this->assertEquals('pending', $order->fresh()->payment_status);
    }

    public function test_redirect_proceeds_on_verified_status_api(): void
    {
        $invoice = $this->newInvoice('C');
        $order = Order::factory()->create([
            'doku_order_id' => $invoice,
            'payment_status' => 'pending',
        ]);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $invoice,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'redirect-'.$order->id,
            'invoice_number' => $invoice,
            'merchant_request_id' => 'redirect-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
        ]);

        Http::fake([
            '*/orders/v1/status/'.$invoice => Http::response([
                'order' => ['invoice_number' => $invoice],
                'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total],
            ], 200),
        ]);

        $response = $this->get('/payment/doku/redirect?invoice_number='.$invoice.'&status=SUCCESS');

        $response->assertRedirect();
        $this->assertEquals('paid', $order->fresh()->payment_status);
        $this->assertNotNull($order->fresh()->paid_at);
    }

    public function test_redirect_resolves_order_from_attempt_invoice_number(): void
    {
        // DOKU echoes back order.invoice_number, which is the payment attempt's
        // namespaced invoice, not the customer-facing order_code.
        // Failing to resolve it bounced the customer to the dashboard after paying.
        $order = Order::factory()->create([
            'order_code' => 'DOMBI-20260916-0001',
            'payment_status' => 'pending',
        ]);
        $invoice = $this->newInvoice('D');
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'invoice-lookup-'.$order->id,
            'invoice_number' => $invoice,
            'merchant_request_id' => 'invoice-lookup-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
        ]);

        Http::fake([
            '*/orders/v1/status/*' => Http::response([
                'order' => ['invoice_number' => $invoice],
                'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total],
            ], 200),
        ]);

        $response = $this->get('/payment/doku/redirect?invoice_number='.$invoice.'&status=SUCCESS');

        $response->assertRedirect(route('customer.orders.confirm', ['orderCode' => $order->order_code]));
        $this->assertEquals('paid', $order->fresh()->payment_status);
    }

    public function test_redirect_rejects_old_invoice_without_status_lookup_or_payment_mutation(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $invoice = 'DMB-'.$order->id.'-abcdef123456';
        $attempt = $this->createAttemptForInvoice($order, $invoice);
        Http::fake();

        $response = $this->get('/payment/doku/redirect?invoice_number='.$invoice.'&status=SUCCESS');

        $response->assertRedirect(route('customer.home'));
        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertSame('pending', $attempt->fresh()->settlement_status->value);
        $this->assertSame('rejected', PaymentWebhookLog::where('source', 'redirect')->value('status'));
        Http::assertNothingSent();
    }

    public function test_status_sync_skips_old_format_invoice_without_provider_request_or_payment_mutation(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $attempt = $this->createAttemptForInvoice($order, 'DMB-'.$order->id.'-abcdef123456');
        Http::fake();

        $status = $this->doku->syncStatusFromDoku($attempt);

        $this->assertSame('pending', $status);
        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertSame('pending', $attempt->fresh()->settlement_status->value);
        Http::assertNothingSent();
    }

    public function test_manual_canonical_lookup_rejects_old_invoice_without_payment_mutation(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $invoice = 'DMB-'.$order->id.'-abcdef123456';
        $attempt = $this->createAttemptForInvoice($order, $invoice);

        try {
            $this->doku->processPaymentStatusChange($order, 'paid', [
                'order' => ['invoice_number' => $invoice],
                'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total],
            ]);
            $this->fail('Old-format invoice unexpectedly reached canonical payment matching.');
        } catch (\LogicException $exception) {
            $this->assertSame('invoice_namespace_mismatch', $exception->getMessage());
        }

        $this->assertSame('pending', $order->fresh()->payment_status);
        $this->assertSame('pending', $attempt->fresh()->settlement_status->value);
    }

    public function test_redirect_falls_back_to_home_for_unknown_invoice(): void
    {
        $response = $this->get('/payment/doku/redirect?invoice_number=DMB-999-unknown&status=SUCCESS');

        $response->assertRedirect(route('customer.home'));
    }
}
