<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryBoardTest extends TestCase
{
    use RefreshDatabase;

    private function makeContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890'.rand(1000, 9999)]);
        $outletUser = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Test',
            'kelurahan' => 'Menteng',
            'kecamatan' => 'Menteng',
            'address' => 'Jl. Test',
            'latitude' => -6.2,
            'longitude' => 106.8,
            'phone' => '08123456789',
            'status' => 'active',
        ]);
        $outletUser->update(['outlet_id' => $outlet->id]);
        $product = Product::create([
            'name' => 'Nasi Goreng',
            'slug' => 'nasi-goreng-'.uniqid(),
            'price' => 25000,
            'is_active' => true,
        ]);
        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 100,
            'reserved_stock' => 0,
            'minimum_stock' => 10,
        ]);

        return compact('owner', 'courier', 'customer', 'outletUser', 'outlet', 'product');
    }

    private function makeOrder(array $ctx, string $status = 'ready_for_pickup'): Order
    {
        return Order::create([
            'customer_id' => $ctx['customer']->id,
            'outlet_id' => $ctx['outlet']->id,
            'order_code' => 'ORD-'.strtoupper(substr(uniqid(), -6)),
            'status' => $status,
            'fulfillment_type' => 'delivery_dombi',
            'subtotal' => 25000,
            'delivery_fee' => 5000,
            'total' => 30000,
            'customer_name' => 'Budi',
            'customer_phone' => '08123456789',
            'customer_address' => 'Jl. Customer',
            'latitude' => -6.21,
            'longitude' => 106.81,
            'ordered_at' => now(),
        ]);
    }

    public function test_owner_can_view_delivery_board(): void
    {
        $ctx = $this->makeContext();
        $this->makeOrder($ctx);

        $this->actingAs($ctx['owner'])
            ->get(route('owner.deliveries.board'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/deliveries/board')
                ->has('board')
                ->has('stats')
                ->has('couriers')
            );
    }

    public function test_board_shows_unassigned_orders(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);

        $this->actingAs($ctx['owner'])
            ->get(route('owner.deliveries.board'))
            ->assertInertia(fn ($page) => $page
                ->where('board.unassigned.0.order_code', $order->order_code)
                ->where('board.unassigned.0.type', 'order')
                ->where('board.unassigned.0.status', 'waiting_assignment')
            );
    }

    public function test_board_shows_assigned_deliveries(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'waiting_pickup',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now(),
        ]);

        $this->actingAs($ctx['owner'])
            ->get(route('owner.deliveries.board'))
            ->assertInertia(fn ($page) => $page
                ->where('board.assigned.0.order_code', $order->order_code)
                ->where('board.assigned.0.type', 'delivery')
            );
    }

    public function test_board_shows_in_transit_deliveries(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'delivering',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now(),
            'pickup_time' => now(),
        ]);

        $this->actingAs($ctx['owner'])
            ->get(route('owner.deliveries.board'))
            ->assertInertia(fn ($page) => $page
                ->where('board.inTransit.0.order_code', $order->order_code)
            );
    }

    public function test_board_shows_needs_action_deliveries(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'failed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now(),
            'failed_reason' => 'Alamat tidak ditemukan',
        ]);

        $this->actingAs($ctx['owner'])
            ->get(route('owner.deliveries.board'))
            ->assertInertia(fn ($page) => $page
                ->where('board.needsAction.0.order_code', $order->order_code)
                ->where('board.needsAction.0.status', 'failed')
            );
    }

    public function test_board_shows_completed_deliveries(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'completed',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now(),
            'pickup_time' => now(),
            'delivered_time' => now(),
        ]);

        $this->actingAs($ctx['owner'])
            ->get(route('owner.deliveries.board'))
            ->assertInertia(fn ($page) => $page
                ->where('board.completed.0.order_code', $order->order_code)
            );
    }

    public function test_board_stats_include_delivery_counts(): void
    {
        $ctx = $this->makeContext();
        $this->makeOrder($ctx);

        $this->actingAs($ctx['owner'])
            ->get(route('owner.deliveries.board'))
            ->assertInertia(fn ($page) => $page
                ->where('stats.unassigned', 1)
                ->where('stats.assigned', 0)
                ->where('stats.inTransit', 0)
                ->where('stats.needsAction', 0)
            );
    }

    public function test_board_filters_by_outlet(): void
    {
        $ctx = $this->makeContext();
        $this->makeOrder($ctx);

        $this->actingAs($ctx['owner'])
            ->get(route('owner.deliveries.board', ['outlet_id' => $ctx['outlet']->id]))
            ->assertInertia(fn ($page) => $page
                ->where('stats.unassigned', 1)
            );

        $this->actingAs($ctx['owner'])
            ->get(route('owner.deliveries.board', ['outlet_id' => 999]))
            ->assertInertia(fn ($page) => $page
                ->where('stats.unassigned', 0)
            );
    }

    public function test_outlet_can_view_their_deliveries(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);

        $this->actingAs($ctx['outletUser'])
            ->get(route('outlet.deliveries.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/deliveries/index')
                ->has('unassignedOrders')
                ->has('deliveries')
                ->has('stats')
            );
    }

    public function test_outlet_delivery_stats_are_correct(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);

        $this->actingAs($ctx['outletUser'])
            ->get(route('outlet.deliveries.index'))
            ->assertInertia(fn ($page) => $page
                ->where('stats.needsDispatch', 1)
                ->where('stats.waitingPickup', 0)
                ->where('stats.inTransit', 0)
                ->where('stats.failed', 0)
            );
    }
}
