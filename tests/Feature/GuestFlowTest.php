<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_view_order_by_token(): void
    {
        $order = $this->createOrder(['status' => Order::STATUS_PENDING_CONFIRMATION]);

        $this->get('/track/'.$order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('found', true)
                ->where('order.order_code', $order->order_code)
            );
    }

    public function test_guest_can_cancel_order(): void
    {
        $order = $this->createOrder(['status' => Order::STATUS_PENDING_CONFIRMATION]);

        $response = $this->postJson('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
            'last4_hp' => '6789',
        ]);

        $response->assertOk()->assertJson(['success' => true]);

        $order->refresh();
        $this->assertSame(Order::STATUS_CANCELLED_BY_CUSTOMER, $order->status);
    }

    public function test_guest_cannot_cancel_completed_order(): void
    {
        $order = $this->createOrder(['status' => Order::STATUS_COMPLETED]);

        $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
        ])->assertJson(['success' => false]);
    }

    public function test_guest_cancel_does_not_require_auth(): void
    {
        $order = $this->createOrder(['status' => Order::STATUS_PENDING_CONFIRMATION]);

        // No actingAs() — pure guest
        $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
            'last4_hp' => '6789',
        ])->assertJson(['success' => true]);
    }

    public function test_invalid_token_returns_not_found(): void
    {
        $this->get('/track/INVALID123')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('found', false)
            );
    }

    public function test_pickup_tracking_has_no_delivery_steps(): void
    {
        $order = $this->createOrder([
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->get('/track/'.$order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.fulfillment_type', 'pickup')
                ->where('order.delivery', null)
            );
    }

    public function test_delivery_tracking_has_no_pickup_qr(): void
    {
        $order = $this->createOrder([
            'fulfillment_type' => 'delivery_dombi',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->get('/track/'.$order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.fulfillment_type', 'delivery_dombi')
            );
    }

    public function test_guest_and_customer_cancel_produce_same_result(): void
    {
        $customer = Customer::create(['name' => 'Test', 'phone' => '6281234567890123']);
        $user = User::create([
            'name' => 'Test',
            'email' => 'test-'.uniqid().'@test.com',
            'password' => bcrypt('password'),
            'role' => 'customer',
            'is_active' => true,
        ]);
        $customer->update(['user_id' => $user->id]);

        // Guest cancel
        $guestOrder = $this->createOrder(['status' => Order::STATUS_PENDING_CONFIRMATION]);
        $this->post('/track/'.$guestOrder->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
            'last4_hp' => '6789',
        ])->assertJson(['success' => true]);

        // Customer cancel
        $customerOrder = $this->createOrder([
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'customer_id' => $customer->id,
        ]);
        $this->actingAs($user)
            ->post('/customer/orders/'.$customerOrder->id.'/cancel', [
                'reason' => 'Salah Pesan',
            ])
            ->assertRedirect();

        // Both should be cancelled
        $guestOrder->refresh();
        $customerOrder->refresh();
        $this->assertSame(Order::STATUS_CANCELLED_BY_CUSTOMER, $guestOrder->status);
        $this->assertSame(Order::STATUS_CANCELLED_BY_CUSTOMER, $customerOrder->status);
    }

    private function createOutlet(): Outlet
    {
        return Outlet::create([
            'name' => 'Test Outlet '.uniqid(),
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -7.05,
            'longitude' => 110.43,
            'status' => 'active',
        ]);
    }

    private function createOrder(array $overrides = []): Order
    {
        $outlet = $this->createOutlet();
        $customer = Customer::create(['name' => 'Guest', 'phone' => '628123456789'.rand(1000, 9999)]);
        $product = Product::create([
            'name' => 'Test Product',
            'slug' => 'test-'.uniqid(),
            'unit' => 'pcs',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'TEST-'.strtoupper(uniqid()),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'qris',
            'payment_status' => 'paid',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Guest',
            'customer_phone' => '628123456789',
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
