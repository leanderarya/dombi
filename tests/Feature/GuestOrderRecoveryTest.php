<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestOrderRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_recovery_returns_orders_for_valid_phone(): void
    {
        $customer = $this->createCustomerWithOrders();

        $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
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

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
        ])->assertOk();

        $data = $response->json();
        $this->assertGreaterThan(0, count($data['active_orders']));
        $this->assertTrue(in_array($data['active_orders'][0]['status'], Order::ACTIVE_STATUSES));
    }

    public function test_recovery_returns_recent_history(): void
    {
        $customer = $this->createCustomerWithOrders();

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
        ])->assertOk();

        $data = $response->json();
        $this->assertIsArray($data['recent_orders']);
    }

    public function test_recovery_normalizes_phone_format(): void
    {
        $customer = $this->createCustomerWithOrders();

        // Try with different phone formats
        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
        ])->assertOk()->assertJson(['found' => true]);

        $this->postJson('/customer/orders/recovery', [
            'phone' => '81234567890',
        ])->assertOk()->assertJson(['found' => true]);
    }

    public function test_recovery_validates_phone_input(): void
    {
        $this->postJson('/customer/orders/recovery', [
            'phone' => '123',
        ])->assertUnprocessable();
    }

    public function test_recovery_limits_results(): void
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890',
        ]);

        $outlet = $this->createOutlet();
        $product = $this->createProduct();

        // Create 15 completed orders
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
        }

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
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
        $this->assertMatchesRegularExpression('/^[A-Z0-9]{6,8}$/', $order->recovery_token);
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

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
        ])->assertOk();

        $data = $response->json();
        $this->assertGreaterThan(0, count($data['active_orders']));
        $this->assertSame('pending_confirmation', $data['active_orders'][0]['status']);
    }

    public function test_recovery_returns_orders_with_outlet_object_and_items_array(): void
    {
        $customer = $this->createCustomerWithOrders();

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567890',
        ])->assertOk();

        $data = $response->json();

        // Active order has outlet as object with name
        $activeOrder = $data['active_orders'][0];
        $this->assertIsArray($activeOrder['outlet']);
        $this->assertArrayHasKey('name', $activeOrder['outlet']);
        $this->assertSame('Outlet Test', $activeOrder['outlet']['name']);

        // Active order has items as array
        $this->assertIsArray($activeOrder['items']);
        $this->assertGreaterThan(0, count($activeOrder['items']));
        $this->assertArrayHasKey('product_name', $activeOrder['items'][0]);
        $this->assertArrayHasKey('quantity', $activeOrder['items'][0]);

        // Active order has created_at for frontend date display
        $this->assertNotNull($activeOrder['created_at']);

        // Recent order also has correct shape
        $recentOrder = $data['recent_orders'][0];
        $this->assertIsArray($recentOrder['outlet']);
        $this->assertArrayHasKey('name', $recentOrder['outlet']);
        $this->assertIsArray($recentOrder['items']);
        $this->assertNotNull($recentOrder['created_at']);
    }

    private function createCustomerWithOrders(): Customer
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890',
        ]);

        $outlet = $this->createOutlet();
        $product = $this->createProduct();

        // Create active order
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

        // Create completed order
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
        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-recovery',
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        return $product;
    }
}
