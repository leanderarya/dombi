<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletScanTest extends TestCase
{
    use RefreshDatabase;

    public function test_scan_page_renders_for_outlet_user(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);

        $this->actingAs($user)
            ->get('/outlet/scan')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/scan')
            );
    }

    public function test_scan_page_requires_auth(): void
    {
        $this->get('/outlet/scan')
            ->assertRedirect('/login');
    }

    public function test_scan_page_requires_outlet_role(): void
    {
        $user = User::create([
            'name' => 'Customer User',
            'email' => 'cust-' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'customer',
        ]);

        $this->actingAs($user)
            ->get('/outlet/scan')
            ->assertForbidden();
    }

    public function test_lookup_returns_order_by_valid_code(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson([
                'found' => true,
                'order' => [
                    'id' => $order->id,
                    'order_code' => $order->order_code,
                    'status' => Order::STATUS_READY_FOR_PICKUP,
                ],
            ]);
    }

    public function test_lookup_returns_not_found_for_invalid_code(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);

        $this->actingAs($user)
            ->get('/outlet/scan/INVALID-CODE')
            ->assertOk()
            ->assertJson(['found' => false]);
    }

    public function test_lookup_returns_not_found_for_other_outlet_order(): void
    {
        $outlet1 = $this->createOutlet();
        $outlet2 = $this->createOutlet();
        $user = $this->createOutletUser($outlet1);
        $order = $this->createOrder($outlet2, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson(['found' => false]);
    }

    public function test_lookup_rejects_order_not_ready_for_pickup(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_PREPARING,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson([
                'found' => false,
                'error' => 'Pesanan belum siap diambil.',
            ]);
    }

    public function test_lookup_rejects_already_completed_order(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_COMPLETED,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson([
                'found' => false,
                'error' => 'Pesanan sudah selesai.',
            ]);
    }

    public function test_lookup_rejects_cancelled_order(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson([
                'found' => false,
                'error' => 'Pesanan sudah dibatalkan.',
            ]);
    }

    public function test_lookup_rejects_delivery_order(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'delivery_dombi',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson(['found' => false]);
    }

    public function test_lookup_is_case_insensitive(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get('/outlet/scan/' . strtolower($order->order_code))
            ->assertOk()
            ->assertJson(['found' => true]);
    }

    public function test_lookup_includes_items(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson([
                'found' => true,
                'order' => [
                    'items' => [
                        ['product_name' => 'Susu Kambing 500ml', 'quantity' => 2],
                    ],
                ],
            ]);
    }

    public function test_end_to_end_scan_and_complete_pickup(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        // Step 1: Scan lookup returns order
        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson(['found' => true]);

        // Step 2: Confirm pickup via existing endpoint
        $this->actingAs($user)
            ->post("/outlet/orders/{$order->id}/complete-pickup")
            ->assertRedirect();

        // Step 3: Order is now completed
        $order->refresh();
        $this->assertSame(Order::STATUS_COMPLETED, $order->status);
    }

    public function test_only_outlet_owner_can_complete_pickup(): void
    {
        $outlet1 = $this->createOutlet();
        $outlet2 = $this->createOutlet();
        $user1 = $this->createOutletUser($outlet1);
        $order = $this->createOrder($outlet2, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user1)
            ->post("/outlet/orders/{$order->id}/complete-pickup")
            ->assertForbidden();
    }

    private function createOutlet(): Outlet
    {
        return Outlet::create([
            'name' => 'Outlet Test ' . uniqid(),
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
            'status' => 'active',
        ]);
    }

    private function createOutletUser(Outlet $outlet): User
    {
        return User::create([
            'name' => 'Outlet Staff',
            'email' => 'outlet-' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
            'is_active' => true,
        ]);
    }

    private function createOrder(Outlet $outlet, array $overrides = []): Order
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890' . rand(1000, 9999),
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-scan-' . uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-SCAN-' . strtoupper(uniqid()),
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'cod',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
        ], $overrides));

        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => $product->price,
            'subtotal' => 50000,
        ]);

        return $order;
    }
}
