<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestOrderRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_recovery_returns_orders_for_valid_phone_and_token(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk()
            ->assertJson([
                'found' => true,
                'customer_name' => 'Test Customer',
            ])
            ->assertJsonStructure([
                'found',
                'customer_name',
                'active_orders' => [['id', 'order_code', 'status', 'total']],
                'recent_orders' => [['id', 'order_code', 'status', 'total']],
            ]);
    }

    public function test_recovery_returns_empty_for_unknown_phone(): void
    {
        $this->postJson('/customer/orders/recovery', [
            'phone' => '089999999999',
            'recovery_token' => 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4',
        ])->assertOk()
            ->assertJson([
                'found' => false,
                'active_orders' => [],
                'recent_orders' => [],
            ]);
    }

    public function test_recovery_returns_active_orders(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();

        $data = $response->json();
        $this->assertGreaterThan(0, count($data['active_orders']));
        $this->assertTrue(in_array($data['active_orders'][0]['status'], Order::ACTIVE_STATUSES));
    }

    public function test_recovery_returns_recent_history(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();

        $data = $response->json();
        $this->assertIsArray($data['recent_orders']);
    }

    public function test_recovery_normalizes_phone_format(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        // 628... format
        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk()->assertJson(['found' => true]);

        // 8... format (without leading 0)
        $this->postJson('/customer/orders/recovery', [
            'phone' => '81234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk()->assertJson(['found' => true]);

        // 08... format
        $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk()->assertJson(['found' => true]);

        // +628... format
        $this->postJson('/customer/orders/recovery', [
            'phone' => '+6281234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk()->assertJson(['found' => true]);
    }

    public function test_recovery_validates_phone_input(): void
    {
        $this->postJson('/customer/orders/recovery', [
            'phone' => '123',
        ])->assertUnprocessable();
    }

    public function test_recovery_with_phone_only_requires_verification(): void
    {
        $customer = $this->createCustomerWithOrders();

        $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
        ])->assertOk()
            ->assertJson([
                'found' => true,
                'requires_verification' => true,
            ])
            ->assertJsonStructure([
                'found',
                'requires_verification',
                'message',
            ])
            ->assertJsonMissing(['customer_name', 'customer_id', 'active_orders', 'recent_orders']);
    }

    public function test_recovery_with_phone_only_returns_empty_for_unknown_phone(): void
    {
        $this->postJson('/customer/orders/recovery', [
            'phone' => '089999999999',
        ])->assertOk()
            ->assertJson([
                'found' => false,
            ])
            ->assertJsonMissing(['requires_verification']);
    }

    public function test_recovery_with_phone_only_normalizes_formats(): void
    {
        $customer = $this->createCustomerWithOrders();

        // 08... format
        $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
        ])->assertOk()->assertJson(['found' => true]);

        // 628... format
        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
        ])->assertOk()->assertJson(['found' => true]);

        // +628... format
        $this->postJson('/customer/orders/recovery', [
            'phone' => '+6281234567890',
        ])->assertOk()->assertJson(['found' => true]);

        // 8... format
        $this->postJson('/customer/orders/recovery', [
            'phone' => '81234567890',
        ])->assertOk()->assertJson(['found' => true]);
    }

    public function test_recovery_with_order_code(): void
    {
        $customer = $this->createCustomerWithOrders();

        $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'order_code' => 'DOMBI-ACTIVE-001',
        ])->assertOk()
            ->assertJson(['found' => true]);
    }

    public function test_recovery_limits_results(): void
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890',
        ]);

        $outlet = $this->createOutlet();
        $product = $this->createProduct();

        $lastToken = null;
        for ($i = 0; $i < 15; $i++) {
            $order = Order::create([
                'customer_id' => $customer->id,
                'outlet_id' => $outlet->id,
                'order_code' => sprintf('DOMBI-TEST-%04d', $i + 1),
                'status' => 'completed',
                'fulfillment_type' => 'pickup',
                'subtotal' => 25000,
                'delivery_fee' => 0,
                'payment_method' => 'cod',
                'payment_fee' => 0,
                'total' => 25000,
                'customer_name' => 'Test Customer',
                'customer_phone' => '6281234567890',
                'customer_address' => 'Ambil di Outlet Test',
                'ordered_at' => now(),
            ]);

            $order->items()->create([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'quantity' => 1,
                'price' => $product->price,
                'subtotal' => 25000,
            ]);

            $lastToken = $order->recovery_token;
        }

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'recovery_token' => $lastToken,
        ])->assertOk();

        $data = $response->json();
        $this->assertLessThanOrEqual(10, count($data['recent_orders']));
    }

    public function test_recovery_token_is_generated_automatically(): void
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890',
        ]);

        $outlet = $this->createOutlet();

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-TOKEN-001',
            'status' => 'pending_confirmation',
            'fulfillment_type' => 'pickup',
            'subtotal' => 25000,
            'delivery_fee' => 0,
            'payment_method' => 'cod',
            'payment_fee' => 0,
            'total' => 25000,
            'customer_name' => 'Test',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Test',
            'ordered_at' => now(),
        ]);

        $this->assertNotNull($order->recovery_token);
        $this->assertMatchesRegularExpression('/^[A-F0-9]{32}$/', $order->recovery_token);
    }

    public function test_recovery_tokens_are_unique(): void
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890',
        ]);

        $outlet = $this->createOutlet();

        $tokens = [];
        for ($i = 0; $i < 10; $i++) {
            $order = Order::create([
                'customer_id' => $customer->id,
                'outlet_id' => $outlet->id,
                'order_code' => sprintf('DOMBI-UNIQ-%04d', $i + 1),
                'status' => 'completed',
                'fulfillment_type' => 'pickup',
                'subtotal' => 25000,
                'delivery_fee' => 0,
                'payment_method' => 'cod',
                'payment_fee' => 0,
                'total' => 25000,
                'customer_name' => 'Test',
                'customer_phone' => '6281234567890',
                'customer_address' => 'Test',
                'ordered_at' => now(),
            ]);

            $tokens[] = $order->recovery_token;
        }

        $this->assertCount(10, array_unique($tokens));
    }

    public function test_recovery_returns_active_orders_first(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();

        $data = $response->json();
        $this->assertGreaterThan(0, count($data['active_orders']));
        $this->assertSame('pending_confirmation', $data['active_orders'][0]['status']);
    }

    public function test_recovery_returns_orders_with_outlet_object_and_items_array(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();

        $data = $response->json();

        $activeOrder = $data['active_orders'][0];
        $this->assertIsArray($activeOrder['outlet']);
        $this->assertArrayHasKey('name', $activeOrder['outlet']);
        $this->assertSame('Outlet Test', $activeOrder['outlet']['name']);

        $this->assertIsArray($activeOrder['items']);
        $this->assertGreaterThan(0, count($activeOrder['items']));
        $this->assertArrayHasKey('product_name', $activeOrder['items'][0]);
        $this->assertArrayHasKey('quantity', $activeOrder['items'][0]);

        $this->assertNotNull($activeOrder['created_at']);

        $recentOrder = $data['recent_orders'][0];
        $this->assertIsArray($recentOrder['outlet']);
        $this->assertArrayHasKey('name', $recentOrder['outlet']);
        $this->assertIsArray($recentOrder['items']);
        $this->assertNotNull($recentOrder['created_at']);
    }

    // ─── GUEST TRACKING ACCESS ──────────────────────────────────────

    public function test_recovery_response_includes_recovery_token(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();

        $data = $response->json();
        $this->assertArrayHasKey('recovery_token', $data['active_orders'][0]);
        $this->assertSame($order->recovery_token, $data['active_orders'][0]['recovery_token']);
    }

    public function test_recovery_response_includes_public_tracking_url(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();

        $data = $response->json();
        $this->assertArrayHasKey('tracking_url', $data['active_orders'][0]);
        $this->assertSame(url('/track/'.$order->recovery_token), $data['active_orders'][0]['tracking_url']);
    }

    public function test_recovery_accepts_existing_64_character_tokens(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();
        $token = str_repeat('A', 64);
        $order->forceFill(['recovery_token' => $token])->save();

        $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
            'recovery_token' => $token,
        ])->assertOk()
            ->assertJson([
                'found' => true,
                'customer_name' => 'Test Customer',
            ]);
    }

    public function test_guest_can_access_tracking_page_without_auth(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        $this->get('/track/'.$order->recovery_token)
            ->assertOk();
    }

    public function test_guest_tracking_with_invalid_token_returns_not_found(): void
    {
        $this->get('/track/INVALIDTOKEN12345678901234567890')
            ->assertOk();
    }

    public function test_guest_redirected_from_customer_orders_to_login(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        $this->get('/customer/orders/'.$order->id)
            ->assertRedirect('/login');
    }

    public function test_authenticated_customer_can_access_order_detail(): void
    {
        $customer = $this->createCustomerWithOrders();
        $order = Order::where('customer_id', $customer->id)->first();

        $user = User::factory()->create([
            'role' => 'customer',
            'is_active' => true,
        ]);

        // Link customer to user
        $customer->update(['user_id' => $user->id]);

        $this->actingAs($user)
            ->get('/customer/orders/'.$order->id)
            ->assertOk();
    }

    public function test_phone_only_recovery_does_not_expose_order_data(): void
    {
        $customer = $this->createCustomerWithOrders();

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
        ])->assertOk();

        $data = $response->json();
        $this->assertTrue($data['found']);
        $this->assertTrue($data['requires_verification']);
        $this->assertArrayNotHasKey('active_orders', $data);
        $this->assertArrayNotHasKey('recent_orders', $data);
        $this->assertArrayNotHasKey('recovery_token', $data);
        $this->assertArrayNotHasKey('customer_id', $data);
    }

    private function createCustomerWithOrders(): Customer
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890',
        ]);

        $outlet = $this->createOutlet();
        $product = $this->createProduct();

        $activeOrder = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-ACTIVE-001',
            'status' => 'pending_confirmation',
            'fulfillment_type' => 'delivery_dombi',
            'subtotal' => 50000,
            'delivery_fee' => 5000,
            'payment_method' => 'cod',
            'payment_fee' => 0,
            'total' => 55000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Jl. Test No. 123',
            'ordered_at' => now(),
        ]);

        $activeOrder->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => 25000,
            'subtotal' => 50000,
        ]);

        $completedOrder = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-DONE-001',
            'status' => 'completed',
            'fulfillment_type' => 'pickup',
            'subtotal' => 25000,
            'delivery_fee' => 0,
            'payment_method' => 'cod',
            'payment_fee' => 0,
            'total' => 25000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Ambil di Outlet Test',
            'ordered_at' => now()->subDay(),
        ]);

        $completedOrder->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 1,
            'price' => 25000,
            'subtotal' => 25000,
        ]);

        return $customer;
    }

    private function createOutlet(): Outlet
    {
        return Outlet::create([
            'name' => 'Outlet Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
            'status' => 'active',
        ]);
    }

    private function createProduct(): Product
    {
        return Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-recovery',
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);
    }
}
