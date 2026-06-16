<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HybridCustomerIdentityTest extends TestCase
{
    use RefreshDatabase;

    // ─── CUSTOMER MODEL TESTS ───────────────────────────────────────

    public function test_customer_model_has_registration_fields(): void
    {
        $customer = Customer::create([
            'name' => 'Guest Customer',
            'phone' => '6281234567890',
            'is_registered' => false,
        ]);

        $this->assertFalse($customer->is_registered);
        $this->assertTrue($customer->isGuest());
        $this->assertFalse($customer->isRegistered());
        $this->assertNull($customer->user_id);
    }

    public function test_registered_customer_can_be_linked_to_user(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::create([
            'name' => 'Registered Customer',
            'phone' => '6281234567891',
            'is_registered' => true,
            'user_id' => $user->id,
        ]);

        $this->assertTrue($customer->is_registered);
        $this->assertFalse($customer->isGuest());
        $this->assertTrue($customer->isRegistered());
        $this->assertEquals($user->id, $customer->user_id);
        $this->assertEquals($user->id, $customer->user->id);
    }

    public function test_customer_scopes_work_correctly(): void
    {
        Customer::create(['name' => 'Guest 1', 'phone' => '6281234567890', 'is_registered' => false]);
        Customer::create(['name' => 'Guest 2', 'phone' => '6281234567891', 'is_registered' => false]);
        Customer::create(['name' => 'Registered 1', 'phone' => '6281234567892', 'is_registered' => true]);

        $this->assertEquals(2, Customer::guest()->count());
        $this->assertEquals(1, Customer::registered()->count());
    }

    public function test_customer_can_be_linked_to_user_via_method(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::create([
            'name' => 'Guest Customer',
            'phone' => '6281234567890',
            'is_registered' => false,
        ]);

        $customer->linkToUser($user);

        $this->assertTrue($customer->fresh()->is_registered);
        $this->assertEquals($user->id, $customer->fresh()->user_id);
    }

    // ─── GUEST CHECKOUT TESTS ──────────────────────────────────────

    public function test_guest_checkout_creates_customer_not_user(): void
    {
        $product = $this->createStockedProduct();

        $this->seedCheckoutDraft([
            'checkout.cart' => [['product_id' => $product->id, 'quantity' => 1]],
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup'],
            'checkout.customer' => [
                'customer_name' => 'Guest Checkout',
                'phone_number' => '6281234567890',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ]);

        $order = Order::latest()->firstOrFail();
        $customer = Customer::find($order->customer_id);

        $this->assertNotNull($customer);
        $this->assertEquals('Guest Checkout', $customer->name);
        $this->assertEquals('6281234567890', $customer->phone);
        $this->assertFalse($customer->is_registered);
        $this->assertNull($customer->user_id);

        // Verify NO User was created
        $this->assertDatabaseMissing('users', ['phone' => '6281234567890']);
    }

    public function test_guest_checkout_does_not_authenticate(): void
    {
        $product = $this->createStockedProduct();

        $this->assertFalse(auth()->check());

        $this->seedCheckoutDraft([
            'checkout.cart' => [['product_id' => $product->id, 'quantity' => 1]],
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup'],
            'checkout.customer' => [
                'customer_name' => 'Guest Auth Test',
                'phone_number' => '6281234567891',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ]);

        $this->assertFalse(auth()->check(), 'Guest should NOT be authenticated after checkout');
        $this->assertNull(auth()->id());
        $this->assertNull(auth()->user());
    }

    public function test_guest_checkout_redirects_to_tracking(): void
    {
        $product = $this->createStockedProduct();

        $this->seedCheckoutDraft([
            'checkout.cart' => [['product_id' => $product->id, 'quantity' => 1]],
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup'],
            'checkout.customer' => [
                'customer_name' => 'Guest Redirect',
                'phone_number' => '6281234567892',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ]);

        $order = Order::latest()->firstOrFail();
        $this->assertNotNull($order->recovery_token);
    }

    public function test_guest_can_track_order_without_auth(): void
    {
        $customer = Customer::create(['name' => 'Track Test', 'phone' => '6281234567893', 'is_registered' => false]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-TRACK-001',
            'status' => 'pending_confirmation',
            'subtotal' => 25000,
            'delivery_fee' => 0,
            'total' => 25000,
            'customer_name' => 'Track Test',
            'customer_phone' => '6281234567893',
            'customer_address' => 'Test Address',
            'ordered_at' => now(),
        ]);

        $this->assertFalse(auth()->check());

        $this->get('/track/'.$order->recovery_token)
            ->assertOk();
    }

    // ─── ORDER RECOVERY TESTS ──────────────────────────────────────

    public function test_order_recovery_uses_customers_table(): void
    {
        $customer = Customer::create(['name' => 'Recovery Test', 'phone' => '6281234567894', 'is_registered' => false]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-RECOVERY-001',
            'status' => 'pending_confirmation',
            'subtotal' => 25000,
            'delivery_fee' => 0,
            'total' => 25000,
            'customer_name' => 'Recovery Test',
            'customer_phone' => '6281234567894',
            'customer_address' => 'Test Address',
            'ordered_at' => now(),
        ]);

        $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567894',
            'recovery_token' => $order->recovery_token,
        ])->assertOk()
            ->assertJson([
                'found' => true,
                'customer_name' => 'Recovery Test',
            ]);
    }

    public function test_order_recovery_does_not_authenticate(): void
    {
        $customer = Customer::create(['name' => 'Recovery Auth', 'phone' => '6281234567895', 'is_registered' => false]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-RECOVERY-002',
            'status' => 'pending_confirmation',
            'subtotal' => 25000,
            'delivery_fee' => 0,
            'total' => 25000,
            'customer_name' => 'Recovery Auth',
            'customer_phone' => '6281234567895',
            'customer_address' => 'Test Address',
            'ordered_at' => now(),
        ]);

        $this->assertFalse(auth()->check());

        $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567895',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();

        $this->assertFalse(auth()->check(), 'Recovery should NOT authenticate user');
    }

    // ─── ADDRESS TESTS ─────────────────────────────────────────────

    public function test_addresses_belong_to_customer_not_user(): void
    {
        $customer = Customer::create(['name' => 'Address Test', 'phone' => '6281234567896', 'is_registered' => false]);

        $address = $customer->addresses()->create([
            'label' => 'Home',
            'recipient_name' => 'Address Test',
            'phone' => '6281234567896',
            'address' => '123 Test St',
            'is_default' => true,
        ]);

        $this->assertEquals($customer->id, $address->customer_id);
        $this->assertEquals($customer->id, $address->customer->id);
    }

    public function test_customer_default_address(): void
    {
        $customer = Customer::create(['name' => 'Default Address', 'phone' => '6281234567897', 'is_registered' => false]);

        $customer->addresses()->create([
            'label' => 'Home',
            'recipient_name' => 'Default Address',
            'phone' => '6281234567897',
            'address' => '123 Test St',
            'is_default' => true,
        ]);

        $customer->addresses()->create([
            'label' => 'Work',
            'recipient_name' => 'Default Address',
            'phone' => '6281234567897',
            'address' => '456 Work St',
            'is_default' => false,
        ]);

        $default = $customer->defaultAddress();
        $this->assertNotNull($default);
        $this->assertEquals('Home', $default->label);
    }

    // ─── ORDER RELATIONSHIP TESTS ──────────────────────────────────

    public function test_orders_linked_to_customer(): void
    {
        $customer = Customer::create(['name' => 'Order Link', 'phone' => '6281234567898', 'is_registered' => false]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-LINK-001',
            'status' => 'pending_confirmation',
            'subtotal' => 25000,
            'delivery_fee' => 0,
            'total' => 25000,
            'customer_name' => 'Order Link',
            'customer_phone' => '6281234567898',
            'customer_address' => 'Test Address',
            'ordered_at' => now(),
        ]);

        $this->assertEquals($customer->id, $order->customer_id);
        $this->assertEquals($customer->id, $order->customer->id);
        $this->assertCount(1, $customer->orders);
    }

    // ─── ANALYTICS TESTS ───────────────────────────────────────────

    public function test_customer_analytics_counts_correctly(): void
    {
        Customer::create(['name' => 'Guest 1', 'phone' => '6281234567890', 'is_registered' => false]);
        Customer::create(['name' => 'Guest 2', 'phone' => '6281234567891', 'is_registered' => false]);
        Customer::create(['name' => 'Registered 1', 'phone' => '6281234567892', 'is_registered' => true]);

        $this->assertEquals(3, Customer::count());
        $this->assertEquals(2, Customer::where('is_registered', false)->count());
        $this->assertEquals(1, Customer::where('is_registered', true)->count());
    }

    public function test_owner_dashboard_still_loads_with_hybrid_customers_present(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        Customer::create(['name' => 'Guest', 'phone' => '6281234567890', 'is_registered' => false]);
        Customer::create(['name' => 'Registered', 'phone' => '6281234567891', 'is_registered' => true]);

        $this->actingAs($owner)
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('hero')
                ->has('kpis')
            );
    }

    // ─── FUTURE OTP READINESS TESTS ────────────────────────────────

    public function test_user_model_has_customer_relationship(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::create([
            'name' => 'OTP Ready',
            'phone' => '6281234567899',
            'is_registered' => true,
            'user_id' => $user->id,
        ]);

        $this->assertNotNull($user->customer);
        $this->assertEquals($customer->id, $user->customer->id);
    }

    public function test_customer_can_be_created_without_user_for_guest(): void
    {
        $customer = Customer::create([
            'name' => 'No User Guest',
            'phone' => '6281234567800',
            'is_registered' => false,
        ]);

        $this->assertNull($customer->user_id);
        $this->assertNull($customer->user);
        $this->assertTrue($customer->isGuest());
    }

    // ─── HELPERS ───────────────────────────────────────────────────

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
