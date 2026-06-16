<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestCheckoutAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_checkout_does_not_authenticate_user(): void
    {
        $product = $this->createStockedProduct();

        $this->assertFalse(auth()->check(), 'Guest should not be authenticated before checkout');

        $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
            'checkout.customer' => [
                'customer_name' => 'Budi Guest',
                'phone_number' => '6281234567890',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ])->assertRedirect();

        $this->assertFalse(auth()->check(), 'Guest should NOT be authenticated after checkout');
        $this->assertNull(auth()->id(), 'Auth::id() should be null after guest checkout');
        $this->assertNull(auth()->user(), 'Auth::user() should be null after guest checkout');
    }

    public function test_guest_checkout_redirects_to_tracking_page(): void
    {
        $product = $this->createStockedProduct();

        $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
            'checkout.customer' => [
                'customer_name' => 'Sarah Guest',
                'phone_number' => '6281234567891',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ]);

        $order = Order::latest()->firstOrFail();

        $this->assertNotNull($order->recovery_token, 'Order should have a recovery token');
        $this->get('/track/'.$order->recovery_token)->assertOk();
    }

    public function test_authenticated_customer_checkout_redirects_to_order_page(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $product = $this->createStockedProduct();

        $this->actingAs($customer)
            ->seedCheckoutDraft([
                'checkout.cart' => [
                    ['product_id' => $product->id, 'quantity' => 1],
                ],
                'checkout.fulfillment' => [
                    'fulfillment_type' => 'pickup',
                ],
                'checkout.customer' => [
                    'customer_name' => 'Sarah Auth',
                    'phone_number' => '6281234567892',
                ],
            ])
            ->post('/customer/checkout/payment', [
                'payment_method' => 'cod',
            ]);

        $order = Order::latest()->firstOrFail();

        $this->assertTrue(auth()->check(), 'Authenticated customer should remain authenticated');
        $this->assertEquals($customer->id, auth()->id(), 'Authenticated user should be the same customer');
    }

    public function test_guest_remains_unauthenticated_after_multiple_checkouts(): void
    {
        $product = $this->createStockedProduct();

        for ($i = 0; $i < 3; $i++) {
            $this->seedCheckoutDraft([
                'checkout.cart' => [
                    ['product_id' => $product->id, 'quantity' => 1],
                ],
                'checkout.fulfillment' => [
                    'fulfillment_type' => 'pickup',
                ],
                'checkout.customer' => [
                    'customer_name' => "Guest $i",
                    'phone_number' => "628123456789$i",
                ],
            ])->post('/customer/checkout/payment', [
                'payment_method' => 'cod',
            ]);

            $this->assertFalse(auth()->check(), "Guest should not be authenticated after checkout $i");
        }
    }

    public function test_guest_can_access_tracking_after_checkout(): void
    {
        $product = $this->createStockedProduct();

        $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
            'checkout.customer' => [
                'customer_name' => 'Track Test',
                'phone_number' => '6281234567893',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ]);

        $order = Order::latest()->firstOrFail();

        $this->assertFalse(auth()->check());

        $this->get('/track/'.$order->recovery_token)
            ->assertOk();
    }

    public function test_guest_can_still_access_customer_pages(): void
    {
        $this->get('/customer/home')->assertOk();
        $this->get('/customer/products')->assertOk();
        $this->get('/customer/checkout')->assertOk();
        $this->get('/customer/orders')->assertOk();
        $this->get('/customer/profile')->assertOk();
    }

    public function test_guest_checkout_creates_customer_in_database(): void
    {
        $product = $this->createStockedProduct();

        $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
            'checkout.customer' => [
                'customer_name' => 'DB Test',
                'phone_number' => '6281234567894',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ]);

        $order = Order::latest()->firstOrFail();

        $this->assertNotNull($order->customer_id, 'Order should have a customer_id');
        $this->assertDatabaseHas('customers', [
            'id' => $order->customer_id,
            'phone' => '6281234567894',
        ]);
        $this->assertDatabaseMissing('users', [
            'phone' => '6281234567894',
        ]);
    }

    public function test_owner_can_access_owner_dashboard_after_guest_checkout_exists(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $product = $this->createStockedProduct();

        // Create a guest order first
        $this->seedCheckoutDraft([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'pickup',
            ],
            'checkout.customer' => [
                'customer_name' => 'Before Owner',
                'phone_number' => '6281234567895',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ]);

        $this->assertFalse(auth()->check(), 'Should not be authenticated after guest checkout');

        // Now login as owner
        $this->actingAs($owner);

        $this->assertTrue(auth()->check());
        $this->assertEquals('owner', auth()->user()->role);

        // Owner can access their dashboard
        $this->get('/owner/dashboard')->assertOk();
    }

    private function createStockedProduct(): Product
    {
        $outlet = Outlet::create([
            'name' => 'Outlet Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-'.uniqid(),
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

    private function seedCheckoutDraft(array $session): self
    {
        return $this->withSession($session);
    }
}
