<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierContactVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_order_payload_shows_only_courier_name_and_plate(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'user_id' => $user->id,
            'name' => 'Test Customer',
            'phone' => '628123456789',
            'is_registered' => true,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'phone' => '628555000111',
            'vehicle_plate' => 'B 1234 XYZ',
        ]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'status' => Order::STATUS_DELIVERING,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'payment_status' => 'paid',
        ]);
        $order->delivery()->create([
            'courier_id' => $courier->id,
            'status' => 'delivering',
            'assigned_at' => now(),
        ]);

        $this->actingAs($user)
            ->get("/customer/orders/{$order->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/orders/show')
                ->where('order.delivery.courier.name', $courier->name)
                ->where('order.delivery.courier.vehicle_plate', 'B 1234 XYZ')
                ->missing('order.delivery.courier.phone')
                ->missing('order.delivery.courier.latitude')
                ->missing('order.delivery.external_courier_phone'));
    }

    public function test_customer_order_payload_external_courier_shows_name_and_plate_only(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'user_id' => $user->id,
            'name' => 'Test Customer',
            'phone' => '628123456789',
            'is_registered' => true,
        ]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'status' => Order::STATUS_DELIVERING,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'payment_status' => 'paid',
        ]);
        $order->delivery()->create([
            'status' => 'delivering',
            'courier_type' => 'eksternal',
            'external_courier_name' => 'Joko',
            'external_courier_phone' => '628555222333',
            'external_plate_number' => 'D 4321 AB',
            'assigned_at' => now(),
        ]);

        $this->actingAs($user)
            ->get("/customer/orders/{$order->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/orders/show')
                ->where('order.delivery.courier', null)
                ->where('order.delivery.external_courier_name', 'Joko')
                ->where('order.delivery.external_plate_number', 'D 4321 AB')
                ->missing('order.delivery.external_courier_phone'));
    }

    public function test_outlet_order_payload_includes_internal_courier_phone(): void
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'phone' => '628555000111',
            'vehicle_plate' => 'B 1234 XYZ',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'status' => Order::STATUS_DELIVERING,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'payment_status' => 'paid',
        ]);
        $order->delivery()->create([
            'courier_id' => $courier->id,
            'status' => 'delivering',
            'assigned_at' => now(),
        ]);

        $this->actingAs($operator)
            ->get("/outlet/orders/{$order->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/orders/show')
                ->where('order.delivery.courier.phone', '628555000111')
                ->where('order.delivery.courier.vehicle_plate', 'B 1234 XYZ'));
    }

    public function test_customer_confirmation_payload_redacts_courier_contact(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'user_id' => $user->id,
            'name' => 'Test Customer',
            'phone' => '628123456789',
            'is_registered' => true,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'phone' => '628555000111',
            'vehicle_plate' => 'B 1234 XYZ',
        ]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'status' => Order::STATUS_DELIVERING,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'payment_status' => 'paid',
        ]);
        $order->delivery()->create([
            'courier_id' => $courier->id,
            'status' => 'delivering',
            'assigned_at' => now(),
        ]);

        $this->actingAs($user)
            ->get("/customer/orders/{$order->id}/confirmation/{$order->recovery_token}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/orders/show')
                ->where('order.delivery.courier.name', $courier->name)
                ->where('order.delivery.courier.vehicle_plate', 'B 1234 XYZ')
                ->missing('order.delivery.courier.phone')
                ->missing('order.delivery.courier.latitude')
                ->missing('order.delivery.external_courier_phone'));
    }

    public function test_outlet_order_payload_includes_external_courier_contact(): void
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'status' => Order::STATUS_DELIVERING,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'payment_status' => 'paid',
        ]);
        $order->delivery()->create([
            'status' => 'delivering',
            'courier_type' => 'eksternal',
            'external_courier_name' => 'Joko',
            'external_courier_phone' => '628555222333',
            'external_plate_number' => 'D 4321 AB',
            'assigned_at' => now(),
        ]);

        $this->actingAs($operator)
            ->get("/outlet/orders/{$order->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/orders/show')
                ->where('order.delivery.external_courier_name', 'Joko')
                ->where('order.delivery.external_courier_phone', '628555222333')
                ->where('order.delivery.external_plate_number', 'D 4321 AB'));
    }
}
