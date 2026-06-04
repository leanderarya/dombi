<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerOrderSeparationTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_orders_do_not_appear_in_history(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        // Create an active order (delivering)
        $activeOrder = Order::create([
            'customer_id' => $customer->id, 'outlet_id' => $outlet->id, 'order_code' => 'DOMBI-ACTIVE-001',
            'status' => 'delivering', 'subtotal' => 50000, 'delivery_fee' => 0, 'total' => 50000,
            'customer_name' => 'Test', 'customer_phone' => '08', 'customer_address' => 'Addr',
        ]);

        // Create a completed order
        $completedOrder = Order::create([
            'customer_id' => $customer->id, 'outlet_id' => $outlet->id, 'order_code' => 'DOMBI-DONE-001',
            'status' => 'completed', 'subtotal' => 30000, 'delivery_fee' => 0, 'total' => 30000,
            'customer_name' => 'Test', 'customer_phone' => '08', 'customer_address' => 'Addr',
        ]);

        $this->actingAs($customer)
            ->get('/customer/orders')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/orders/index')
                ->has('activeOrders', 1)
                ->has('historyOrders.data', 1)
                ->where('activeOrders.0.order_code', 'DOMBI-ACTIVE-001')
                ->where('historyOrders.data.0.order_code', 'DOMBI-DONE-001')
            );
    }

    public function test_delivering_order_only_in_active_section(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        Order::create([
            'customer_id' => $customer->id, 'outlet_id' => $outlet->id, 'order_code' => 'DOMBI-DELIVER-001',
            'status' => 'delivering', 'subtotal' => 50000, 'delivery_fee' => 0, 'total' => 50000,
            'customer_name' => 'Test', 'customer_phone' => '08', 'customer_address' => 'Addr',
        ]);

        $this->actingAs($customer)
            ->get('/customer/orders')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('activeOrders', 1)
                ->has('historyOrders.data', 0)
            );
    }

    public function test_completed_order_only_in_history_section(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        Order::create([
            'customer_id' => $customer->id, 'outlet_id' => $outlet->id, 'order_code' => 'DOMBI-COMP-001',
            'status' => 'completed', 'subtotal' => 50000, 'delivery_fee' => 0, 'total' => 50000,
            'customer_name' => 'Test', 'customer_phone' => '08', 'customer_address' => 'Addr',
        ]);

        $this->actingAs($customer)
            ->get('/customer/orders')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('activeOrders', 0)
                ->has('historyOrders.data', 1)
            );
    }

    public function test_cancelled_order_only_in_history_section(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        Order::create([
            'customer_id' => $customer->id, 'outlet_id' => $outlet->id, 'order_code' => 'DOMBI-CANCEL-001',
            'status' => 'cancelled_by_outlet', 'subtotal' => 50000, 'delivery_fee' => 0, 'total' => 50000,
            'customer_name' => 'Test', 'customer_phone' => '08', 'customer_address' => 'Addr',
        ]);

        $this->actingAs($customer)
            ->get('/customer/orders')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('activeOrders', 0)
                ->has('historyOrders.data', 1)
                ->where('historyOrders.data.0.status', 'cancelled_by_outlet')
            );
    }

    public function test_history_pagination_works(): void
    {
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        // Create 15 completed orders (more than page size of 12)
        for ($i = 1; $i <= 15; $i++) {
            Order::create([
                'customer_id' => $customer->id, 'outlet_id' => $outlet->id,
                'order_code' => sprintf('DOMBI-PAGE-%04d', $i),
                'status' => 'completed', 'subtotal' => 10000, 'delivery_fee' => 0, 'total' => 10000,
                'customer_name' => 'Test', 'customer_phone' => '08', 'customer_address' => 'Addr',
            ]);
        }

        $this->actingAs($customer)
            ->get('/customer/orders')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('historyOrders.data', 12)
                ->where('historyOrders.last_page', 2)
            );

        // Page 2
        $this->actingAs($customer)
            ->get('/customer/orders?page=2')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('historyOrders.data', 3)
            );
    }

    public function test_order_model_has_status_constants(): void
    {
        $this->assertSame(
            ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'],
            Order::ACTIVE_STATUSES
        );

        $this->assertSame(
            ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'],
            Order::HISTORY_STATUSES
        );
    }
}
