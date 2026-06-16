<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Services\CheckoutOtpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestCustomerCheckoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_open_fulfillment_based_checkout_pages(): void
    {
        $this->get('/customer/home')->assertOk();
        $this->get('/customer/products')->assertOk();
        $this->get('/customer/checkout')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('customer/checkout/index'));
        $this->get('/customer/checkout/customer')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('customer/checkout/customer'));
        $this->get('/customer/checkout/payment')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('customer/checkout/payment'));
    }

    public function test_checkout_step_stores_cart_and_fulfillment_then_redirects_to_customer(): void
    {
        $product = $this->createStockedProduct();

        $this->post('/customer/checkout', [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
            'fulfillment_type' => 'pickup',
        ])->assertRedirect('/customer/checkout/customer')
            ->assertSessionHas('checkout.cart.0.product_id', $product->id)
            ->assertSessionHas('checkout.fulfillment.fulfillment_type', 'pickup');
    }

    public function test_checkout_without_fulfillment_stores_items_and_redirects_to_step_one(): void
    {
        $product = $this->createStockedProduct();

        $this->post('/customer/checkout', [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
        ])->assertRedirect('/customer/checkout')
            ->assertSessionHas('checkout.cart.0.product_id', $product->id)
            ->assertSessionMissing('checkout.fulfillment');
    }

    public function test_customer_checkout_step_hides_ojol_by_rejecting_it_as_a_public_option(): void
    {
        $product = $this->createStockedProduct();

        $this->post('/customer/checkout', [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'fulfillment_type' => 'delivery_ojol',
        ])->assertSessionHasErrors(['fulfillment_type']);
    }

    public function test_pickup_does_not_require_address_and_creates_order_successfully(): void
    {
        $product = $this->createStockedProduct();

        $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
            'checkout.customer' => [
                'customer_name' => 'Sarah Pickup',
                'phone_number' => '6281234567890',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ])->assertRedirect();

        $order = Order::latest()->firstOrFail();

        $this->assertSame('pickup', $order->fulfillment_type);
        $this->assertSame('cod', $order->payment_method);
        $this->assertSame(0.0, (float) $order->delivery_fee);
        $this->assertSame(0.0, (float) $order->payment_fee);
        $this->assertSame(50000.0, (float) $order->total);
        $this->assertSame('Sarah Pickup', $order->customer_name);
    }

    public function test_delivery_dombi_requires_location_before_payment(): void
    {
        $product = $this->createStockedProduct();

        $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
            ],
            'checkout.customer' => [
                'customer_name' => 'Sarah Dombi',
                'phone_number' => '6281234567890',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'transfer',
        ])->assertRedirect('/customer/checkout/customer');
    }

    public function test_delivery_dombi_flow_creates_order_with_fulfillment_and_address(): void
    {
        $product = $this->createStockedProduct();

        $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
            ],
            'checkout.customer' => [
                'customer_name' => 'Sarah Dombi',
                'phone_number' => '6281234567890',
            ],
            'checkout.location' => $this->locationDraft(),
            CheckoutOtpService::SESSION_KEY_OTP_VERIFIED => true,
            CheckoutOtpService::SESSION_KEY_OTP_PHONE => '6281234567890',
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'qris',
        ])->assertRedirect();

        $order = Order::latest()->firstOrFail();

        $this->assertSame('delivery_dombi', $order->fulfillment_type);
        $this->assertSame('qris', $order->payment_method);
        $this->assertEquals(350.0, round((float) $order->payment_fee, 2));
        $this->assertGreaterThan(0, (float) $order->delivery_fee);
        $this->assertGreaterThan(0, (float) $order->delivery_distance_km);
        $this->assertNotNull($order->recommended_outlet_id);
        $this->assertSame('Jl. Ngesrep Timur V No. 12', $order->customer_address);
        $this->assertSame('Blok B3 No 27', $order->customer_address_detail);
        $this->assertSame('Rumah cat hijau dekat mushola', $order->customer_landmark);
        $this->assertEquals(-7.0523456, (float) $order->latitude);
        $this->assertEquals(110.4345678, (float) $order->longitude);
    }

    public function test_delivery_ojol_flow_creates_order_and_marks_manual_fulfillment(): void
    {
        $product = $this->createStockedProduct();

        $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_ojol',
            ],
            'checkout.customer' => [
                'customer_name' => 'Sarah OJOL',
                'phone_number' => '6281234567890',
            ],
            'checkout.location' => $this->locationDraft(),
            CheckoutOtpService::SESSION_KEY_OTP_VERIFIED => true,
            CheckoutOtpService::SESSION_KEY_OTP_PHONE => '6281234567890',
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'card',
        ])->assertRedirect();

        $order = Order::latest()->firstOrFail();

        $this->assertSame('delivery_ojol', $order->fulfillment_type);
        $this->assertSame('card', $order->payment_method);
        $this->assertEquals(1000.0, round((float) $order->payment_fee, 2));
    }

    public function test_existing_customer_is_reused_by_phone_in_fulfillment_flow(): void
    {
        $product = $this->createStockedProduct();
        $existing = Customer::create([
            'name' => 'Existing Customer',
            'phone' => '6281234567890',
        ]);

        $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
            'checkout.customer' => [
                'customer_name' => 'Sarah Existing',
                'phone_number' => '6281234567890',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'transfer',
        ])->assertRedirect();

        $this->assertSame($existing->id, Order::latest()->firstOrFail()->customer_id);
        $this->assertSame(1, Customer::where('phone', '6281234567890')->count());
    }

    public function test_customer_step_requires_location_for_delivery_fulfillment(): void
    {
        $product = $this->createStockedProduct();

        // Guest delivery is now blocked — redirects to login prompt
        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
            ],
        ])->post('/customer/checkout/customer', [
            'customer_name' => 'Sarah Dombi',
            'phone_number' => '081234567890',
        ])->assertRedirect('/customer/checkout/login-prompt');
    }

    public function test_customer_step_can_reuse_existing_checkout_location_without_resubmitting_coordinates(): void
    {
        $product = $this->createStockedProduct();

        // Guest delivery is now blocked — redirects to login prompt
        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
            ],
            'checkout.location' => $this->locationDraft(),
        ])->post('/customer/checkout/customer', [
            'customer_name' => 'Sarah Dombi',
            'phone_number' => '081234567890',
        ])->assertRedirect('/customer/checkout/login-prompt');
    }

    public function test_payment_page_shows_correct_review_summary_from_draft(): void
    {
        $product = $this->createStockedProduct();

        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
            'checkout.customer' => [
                'customer_name' => 'Sarah Dombi',
                'phone_number' => '6281234567890',
            ],
        ])->get('/customer/checkout/payment')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/payment')
                ->where('summary.subtotal', 50000)
                ->where('summary.payment_options.0.value', 'cod')
            );
    }

    public function test_guest_can_access_orders_page_without_login(): void
    {
        $this->get('/customer/orders')->assertOk();
    }

    public function test_guest_can_access_settings_page_without_login(): void
    {
        $this->get('/customer/profile')->assertOk();
    }

    private function createStockedProduct(): Product
    {
        $outlet = Outlet::create([
            'name' => 'Outlet Banyumanik',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Banyumanik',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml',
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 0,
        ]);

        return $product;
    }

    private function locationDraft(): array
    {
        return [
            'address_line' => 'Jl. Ngesrep Timur V No. 12',
            'address_detail' => 'Blok B3 No 27',
            'province' => 'Jawa Tengah',
            'city' => 'Kota Semarang',
            'district' => 'Banyumanik',
            'village' => 'Sumurboto',
            'postal_code' => '50269',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
            'landmark' => 'Rumah cat hijau dekat mushola',
            'delivery_notes' => 'Rumah pagar hijau',
        ];
    }

    private function seedCheckoutDraft(array $session): self
    {
        return $this->withSession($session);
    }
}
