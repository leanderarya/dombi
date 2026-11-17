<?php

namespace Tests\Feature;

use App\Http\Middleware\CheckCustomerAdmission;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\PaymentAttempt;
use App\Models\PaymentWebhookLog;
use App\Models\Product;
use App\Services\DokuService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Symfony\Component\Process\Process;
use Tests\TestCase;
use Tests\WithTestOutlet;

/**
 * Focused contract for the reversible customer admission gate
 * (config/admission.php + App\Http\Middleware\CheckCustomerAdmission).
 *
 * The gate closes NEW checkout/order/payment-initiation routes only. DOKU
 * callbacks stay reachable so already-initiated payments can still land, and
 * an unpersisted notification is never acknowledged with 2xx.
 */
class CustomerAdmissionGateTest extends TestCase
{
    use RefreshDatabase;
    use WithTestOutlet;

    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();

        // Active mode is explicit in tests; production defaults to held.
        config(['admission.customer_checkout' => 'active']);

        config([
            'doku.client_id' => 'test-client-id',
            'doku.api_key' => 'test-api-key',
            'doku.webhook_max_age_seconds' => 300,
        ]);

        $this->outlet = $this->withOutletSession();
    }

    private function holdAdmissions(): void
    {
        config(['admission.customer_checkout' => 'held']);
    }

    public function test_held_admissions_reject_new_checkout_drafts(): void
    {
        $this->holdAdmissions();

        $response = $this->from('/customer/checkout')->post('/customer/checkout', [
            'items' => [['product_id' => 1, 'quantity' => 1]],
            'fulfillment_type' => 'pickup',
            'selected_outlet_id' => $this->outlet->id,
        ]);

        $response->assertRedirect('/customer/checkout');
        $response->assertSessionHasErrors('admission_held');
        $this->assertNull(session('checkout.cart'), 'A held admission must not start a checkout draft.');
    }

    public function test_held_admissions_reject_customer_step_and_order_creation(): void
    {
        $this->holdAdmissions();

        $this->from('/customer/checkout/customer')
            ->post('/customer/checkout/customer', [
                'customer_name' => 'Arya',
                'phone_number' => '6281234567890',
            ])
            ->assertRedirect('/customer/checkout/customer')
            ->assertSessionHasErrors('admission_held');

        $this->from('/customer/checkout')
            ->post('/customer/orders', ['items' => [['product_id' => 1, 'quantity' => 1]]])
            ->assertRedirect('/customer/checkout')
            ->assertSessionHasErrors('admission_held');

        $this->assertSame(0, Order::query()->count(), 'A held admission must not create an order.');
    }

    public function test_held_admissions_reject_payment_initiation_with_actionable_json(): void
    {
        $this->holdAdmissions();

        $order = Order::factory()->create(['payment_status' => 'pending']);

        $this->postJson('/customer/checkout/payment', ['payment_method' => 'qris'])
            ->assertStatus(503)
            ->assertJson([
                'error' => 'admission_held',
                'message' => config('admission.message'),
            ]);

        $this->postJson('/customer/orders/'.$order->id.'/pay')
            ->assertStatus(503)
            ->assertJson(['error' => 'admission_held']);

        $this->assertSame(0, PaymentAttempt::query()->count(), 'A held admission must not create a payment attempt.');
    }

    public function test_held_admissions_keep_doku_callbacks_reachable_and_durable(): void
    {
        $this->holdAdmissions();

        $this->get(route('doku.notify'))
            ->assertOk()
            ->assertJson(['message' => 'OK']);

        $order = Order::factory()->create(['payment_status' => 'pending']);
        $invoice = 'DMB1'.str_repeat('B', 24);
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'admission-'.$order->id,
            'invoice_number' => $invoice,
            'merchant_request_id' => 'admission-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
            'creation_state' => 'created',
        ]);
        $body = json_encode([
            'order' => ['invoice_number' => $invoice, 'amount' => $order->total, 'currency' => 'IDR'],
            'transaction' => ['status' => 'SUCCESS', 'amount' => $order->total],
        ], JSON_THROW_ON_ERROR);

        $this->call('POST', route('doku.notify'), [], [], [], $this->signed('REQ-ADMISSION-HELD', $body), $body)
            ->assertOk();

        // 200 is only returned after the notification is durable and processed.
        $this->assertDatabaseHas('payment_webhook_logs', [
            'request_id' => 'REQ-ADMISSION-HELD',
            'status' => 'processed',
            'signature_valid' => true,
        ]);
        $this->assertSame('paid', $order->fresh()->payment_status);

        $this->get('/payment/doku/redirect?invoice_number=DMB-999-unknown&status=SUCCESS')
            ->assertRedirect(route('customer.home'));
    }

    public function test_unpersisted_notification_is_never_acknowledged(): void
    {
        $this->holdAdmissions();

        Event::listen('eloquent.creating: '.PaymentWebhookLog::class, function (): void {
            throw new UniqueConstraintViolationException(
                'mysql',
                'insert into `payment_webhook_logs` ...',
                [],
                new \RuntimeException('duplicate key'),
            );
        });

        $body = '{"order":{"invoice_number":"DMB1'.str_repeat('C', 24).'"},"transaction":{"status":"SUCCESS"}}';

        $response = $this->call('POST', route('doku.notify'), [], [], [], $this->signed('REQ-ADMISSION-UNPERSISTED', $body), $body);

        $response->assertStatus(503);
        $this->assertSame(0, PaymentWebhookLog::query()->where('request_id', 'REQ-ADMISSION-UNPERSISTED')->count());
    }

    public function test_active_admissions_leave_checkout_behaviour_unchanged(): void
    {
        config(['admission.customer_checkout' => 'active']);

        $product = Product::factory()->create(['is_active' => true, 'selling_price' => 25000]);

        $response = $this->post('/customer/checkout', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'fulfillment_type' => 'pickup',
            'selected_outlet_id' => $this->outlet->id,
        ]);

        $response->assertRedirect(route('customer.checkout.customer'));
        $response->assertSessionHasNoErrors();

        $cart = session('checkout.cart');
        $this->assertCount(1, $cart);
        $this->assertSame($product->id, (int) $cart[0]['product_id']);

        // The gate passes the request through to the controller, which then
        // rejects this unauthenticated guest on its own authorization rule.
        $order = Order::factory()->create();
        $this->postJson('/customer/orders/'.$order->id.'/pay')->assertStatus(403);
    }

    public function test_gate_is_wired_only_to_new_admission_routes_and_never_to_doku_callbacks(): void
    {
        $middlewareFor = static fn (string $name): array => app('router')->getRoutes()->getByName($name)->gatherMiddleware();

        foreach (['customer.checkout.store', 'customer.checkout.customer.store', 'customer.checkout.process-payment', 'customer.orders.store', 'orders.pay'] as $name) {
            $this->assertContains('admission.customer', $middlewareFor($name), "{$name} must be admission-gated.");
        }

        foreach (['doku.notify', 'doku.redirect', 'orders.payment-status', 'customer.orders.confirm', 'customer.products.index'] as $name) {
            $this->assertNotContains('admission.customer', $middlewareFor($name), "{$name} must never be admission-gated.");
        }
    }

    public function test_missing_admission_configuration_fails_closed(): void
    {
        $this->app['config']->offsetUnset('admission.customer_checkout');

        $this->from('/customer/checkout')
            ->post('/customer/checkout', ['items' => [['product_id' => 1, 'quantity' => 1]]])
            ->assertRedirect('/customer/checkout')
            ->assertSessionHasErrors('admission_held');

        $this->assertSame(0, Order::query()->count());

        $order = Order::factory()->create(['payment_status' => 'pending']);
        $this->postJson('/customer/orders/'.$order->id.'/pay')
            ->assertStatus(503)
            ->assertJson(['error' => 'admission_held']);
        $this->assertSame(0, PaymentAttempt::query()->count());
    }

    public function test_unrecognised_admission_values_fail_closed_before_order_creation(): void
    {
        $invalidValues = ['', 'closed', 'false', '0', '1', 'hold', 'paused', 'active-ish'];

        foreach ($invalidValues as $value) {
            config(['admission.customer_checkout' => $value]);

            $this->from('/customer/checkout')
                ->post('/customer/orders', ['items' => [['product_id' => 1, 'quantity' => 1]]])
                ->assertSessionHasErrors('admission_held');
        }

        $this->assertSame(0, Order::query()->count());

        $order = Order::factory()->create(['payment_status' => 'pending']);
        config(['admission.customer_checkout' => 'closed']);
        $this->postJson('/customer/orders/'.$order->id.'/pay')
            ->assertStatus(503)
            ->assertJson(['error' => 'admission_held']);

        $this->assertSame(0, PaymentAttempt::query()->count());
    }

    public function test_cached_admission_configuration_is_authoritative_after_environment_changes(): void
    {
        $cachePath = base_path('bootstrap/cache/admission-test-'.bin2hex(random_bytes(8)).'.php');
        $baseEnvironment = [
            'APP_ENV' => 'testing',
            'APP_KEY' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            'APP_CONFIG_CACHE' => $cachePath,
        ];
        $this->assertFileDoesNotExist($cachePath);

        try {
            $cache = new Process(
                [PHP_BINARY, base_path('artisan'), 'config:cache'],
                base_path(),
                $baseEnvironment + ['ADMISSION_CUSTOMER_CHECKOUT' => 'held'],
            );
            $cache->mustRun();

            $verifyCode = <<<'PHP'
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
echo \App\Http\Middleware\CheckCustomerAdmission::held() ? "held" : "active";
PHP;
            $verify = new Process(
                [PHP_BINARY, '-r', $verifyCode],
                base_path(),
                $baseEnvironment + ['ADMISSION_CUSTOMER_CHECKOUT' => 'active'],
            );
            $verify->mustRun();

            $this->assertSame('held', trim($verify->getOutput()));
        } finally {
            if (is_file($cachePath)) {
                unlink($cachePath);
            }
        }
    }

    public function test_held_admission_values_are_normalized_and_closed(): void
    {
        foreach (['held', 'HELD', ' Held ', 'held '] as $value) {
            config(['admission.customer_checkout' => $value]);

            $this->from('/customer/checkout')
                ->post('/customer/checkout', ['items' => [['product_id' => 1, 'quantity' => 1]]])
                ->assertSessionHasErrors('admission_held');
        }
    }

    public function test_active_and_legacy_open_values_allow_admissions(): void
    {
        foreach (['active', 'open'] as $value) {
            config(['admission.customer_checkout' => $value]);

            $this->assertFalse(CheckCustomerAdmission::held());
        }
    }

    private function signed(string $requestId, string $body): array
    {
        $doku = app(DokuService::class);
        $doku->refreshKeysForTest(
            (string) Config::get('doku.client_id'),
            (string) Config::get('doku.api_key'),
        );
        $timestamp = now('UTC')->format('Y-m-d\\TH:i:s\\Z');

        return [
            'HTTP_Client-Id' => Config::get('doku.client_id'),
            'HTTP_Request-Id' => $requestId,
            'HTTP_Request-Timestamp' => $timestamp,
            'HTTP_Signature' => $doku->signForTest($requestId, $timestamp, '/payment/doku/notify', $body),
        ];
    }
}
