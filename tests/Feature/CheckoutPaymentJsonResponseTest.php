<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\PaymentAttempt;
use App\Services\DokuService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;
use Tests\WithTestOutlet;

class CheckoutPaymentJsonResponseTest extends TestCase
{
    use RefreshDatabase;
    use WithTestOutlet;

    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->outlet = $this->withOutletSession();
    }

    public function test_json_payment_request_returns_actionable_json_when_delivery_location_is_missing(): void
    {
        $this->withoutExceptionHandling();

        $this->withSession([
            'checkout.fulfillment' => ['fulfillment_type' => 'delivery_dombi'],
            'checkout.customer' => [
                'customer_name' => 'Arya',
                'phone_number' => '6281234567890',
            ],
            'checkout.cart' => [['product_id' => 1, 'quantity' => 1]],
        ])->postJson('/customer/checkout/payment', [
            'payment_method' => 'qris',
        ])->assertStatus(422)->assertJson([
            'message' => 'Lengkapi alamat pengiriman terlebih dahulu.',
            'redirect_url' => route('customer.checkout.customer'),
        ]);
    }

    public function test_json_payment_success_returns_order_reference(): void
    {
        $order = Order::factory()->create();

        $orderService = Mockery::mock(OrderService::class);
        $orderService->shouldReceive('createCheckoutOrder')->once()->andReturn($order);
        $this->app->instance(OrderService::class, $orderService);

        $doku = Mockery::mock(DokuService::class);
        $doku->shouldReceive('preparePaymentAttempt')->once()->andReturn(
            PaymentAttempt::create([
                'order_id' => $order->id,
                'attempt_key' => (string) $order->order_code,
                'invoice_number' => (string) $order->order_code,
                'merchant_request_id' => $order->order_code.'-REQ',
                'amount_snapshot' => $order->total,
                'currency_snapshot' => 'IDR',
                'payment_method' => 'qris',
                'creation_state' => 'initiated',
                'settlement_status' => 'pending',
            ])
        );
        $doku->shouldReceive('createPayment')->once()->andReturn('https://sandbox.doku.com/checkout/link/XYZ');

        $this->app->instance(DokuService::class, $doku);

        $this->withSession([
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $this->outlet->id],
            'checkout.customer' => ['customer_name' => 'Arya', 'phone_number' => '6281234567890'],
            'checkout.cart' => [['product_id' => 1, 'quantity' => 1]],
        ])->postJson('/customer/checkout/payment', [
            'payment_method' => 'qris',
        ])->assertOk()->assertJson([
            'payment_url' => 'https://sandbox.doku.com/checkout/link/XYZ',
            'order' => [
                'id' => $order->id,
                'order_code' => $order->order_code,
            ],
        ]);
    }

    public function test_payment_page_exposes_doku_checkout_js_url(): void
    {
        $this->get('/customer/checkout/payment')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/payment')
                ->where('dokuCheckoutJs', 'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js')
            );
    }
}
