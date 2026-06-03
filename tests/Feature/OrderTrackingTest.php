<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderTrackingTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_track_page_returns_order_by_valid_token(): void
    {
        $order = $this->createOrder();

        $this->get('/track/' . $order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('track')
                ->where('found', true)
                ->where('order.order_code', $order->order_code)
                ->where('order.status', 'pending')
            );
    }

    public function test_public_track_page_returns_not_found_for_invalid_token(): void
    {
        $this->get('/track/INVALID1')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('track')
                ->where('found', false)
                ->where('order', null)
            );
    }

    public function test_public_track_page_is_case_insensitive(): void
    {
        $order = $this->createOrder();
        $token = $order->recovery_token;

        $this->get('/track/' . strtolower($token))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('found', true)
                ->where('order.order_code', $order->order_code)
            );
    }

    public function test_public_track_page_does_not_require_auth(): void
    {
        $order = $this->createOrder();

        $this->get('/track/' . $order->recovery_token)
            ->assertOk();
    }

    public function test_track_page_includes_timeline_histories(): void
    {
        $order = $this->createOrder();

        $order->statusHistories()->create([
            'from_status' => null,
            'to_status' => 'pending',
            'notes' => 'Order dibuat',
            'changed_by' => $order->customer_id,
        ]);

        $this->get('/track/' . $order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('found', true)
                ->has('order.status_histories', 1)
            );
    }

    public function test_track_page_includes_delivery_address(): void
    {
        $order = $this->createOrder([
            'customer_address' => 'Jl. Test No. 123',
            'customer_address_detail' => 'Blok A5',
            'customer_landmark' => 'Rumah hijau',
        ]);

        $this->get('/track/' . $order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.customer_address', 'Jl. Test No. 123')
                ->where('order.customer_address_detail', 'Blok A5')
                ->where('order.customer_landmark', 'Rumah hijau')
            );
    }

    public function test_track_page_shows_items(): void
    {
        $order = $this->createOrder();

        $this->get('/track/' . $order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('order.items', 1)
                ->where('order.items.0.product_name', 'Susu Kambing 500ml')
            );
    }

    public function test_recovery_token_is_unique_per_order(): void
    {
        $order1 = $this->createOrder();
        $order2 = $this->createOrder();

        $this->assertNotEquals($order1->recovery_token, $order2->recovery_token);
    }

    private function createOrder(array $overrides = []): Order
    {
        $customer = User::factory()->create([
            'role' => 'customer',
            'phone' => '6281234567890',
        ]);

        $outlet = Outlet::create([
            'name' => 'Outlet Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-tracking-' . uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-TRACK-' . strtoupper(uniqid()),
            'status' => 'pending',
            'fulfillment_type' => 'delivery_dombi',
            'subtotal' => 50000,
            'delivery_fee' => 5000,
            'payment_method' => 'cod',
            'payment_fee' => 0,
            'total' => 55000,
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
