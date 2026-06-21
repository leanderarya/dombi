<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FulfillmentAwarenessTest extends TestCase
{
    use RefreshDatabase;

    public function test_pickup_order_not_counted_in_delivery_queue(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);

        $this->createOrder($outlet, [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->createOrder($outlet, [
            'fulfillment_type' => 'delivery_dombi',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->actingAs($user)
            ->get('/outlet/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.readyForCustomerPickup', 1)
                ->where('deliveryStats.needsDispatch', 1)
            );
    }

    public function test_pickup_order_not_assignable_to_courier(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $pickupOrder = $this->createOrder($outlet, [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->actingAs($user)
            ->post("/outlet/orders/{$pickupOrder->id}/assign-courier", [
                'courier_id' => 1,
            ])
            ->assertSessionHasErrors('courier_id');
    }

    public function test_pickup_order_cannot_enter_delivery_statuses(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $pickupOrder = $this->createOrder($outlet, [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->actingAs($user)
            ->post("/outlet/orders/{$pickupOrder->id}/status", [
                'status' => Order::STATUS_PICKED_UP,
            ])
            ->assertSessionHasErrors('status');
    }

    public function test_delivery_order_cannot_use_complete_pickup(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $deliveryOrder = $this->createOrder($outlet, [
            'fulfillment_type' => 'delivery_dombi',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->actingAs($user)
            ->post("/outlet/orders/{$deliveryOrder->id}/complete-pickup")
            ->assertSessionHasErrors('fulfillment_type');
    }

    public function test_customer_pickup_tracking_has_no_delivery_steps(): void
    {
        $order = $this->createOrder($this->createOutlet(), [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->get('/track/' . $order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.fulfillment_type', 'pickup')
                ->where('order.delivery', null)
            );
    }

    public function test_customer_delivery_tracking_has_no_pickup_qr(): void
    {
        $order = $this->createOrder($this->createOutlet(), [
            'fulfillment_type' => 'delivery_dombi',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $this->get('/track/' . $order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.fulfillment_type', 'delivery_dombi')
            );
    }

    public function test_no_delivery_records_for_pickup_orders(): void
    {
        $outlet = $this->createOutlet();

        $this->createOrder($outlet, [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_COMPLETED,
        ]);
        $this->createOrder($outlet, [
            'fulfillment_type' => 'pickup',
            'status' => Order::STATUS_READY_FOR_PICKUP,
        ]);

        $pickupOrderIds = Order::where('fulfillment_type', 'pickup')->pluck('id');
        $deliveryCount = Delivery::whereIn('order_id', $pickupOrderIds)->count();
        $this->assertSame(0, $deliveryCount, 'Pickup orders should not have delivery records.');
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
            'slug' => 'susu-kambing-500ml-fa-' . uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-FA-' . strtoupper(uniqid()),
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
