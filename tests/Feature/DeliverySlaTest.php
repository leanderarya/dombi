<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\OutletInventory;
use App\Models\Customer;
use App\Models\User;
use App\Services\DeliverySlaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliverySlaTest extends TestCase
{
    use RefreshDatabase;

    private function makeContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890' . rand(1000, 9999)]);
        $outlet = Outlet::create([
            'user_id' => $owner->id,
            'name' => 'Outlet Test',
            'kelurahan' => 'Menteng',
            'kecamatan' => 'Menteng',
            'address' => 'Jl. Test',
            'latitude' => -6.2,
            'longitude' => 106.8,
            'phone' => '08123456789',
            'status' => 'active',
        ]);
        $product = Product::create([
            'name' => 'Nasi Goreng',
            'slug' => 'nasi-goreng-' . uniqid(),
            'price' => 25000,
            'is_active' => true,
        ]);

        return compact('owner', 'courier', 'customer', 'outlet', 'product');
    }

    private function makeOrder(array $ctx): Order
    {
        return Order::create([
            'customer_id' => $ctx['customer']->id,
            'outlet_id' => $ctx['outlet']->id,
            'order_code' => 'ORD-' . strtoupper(substr(uniqid(), -6)),
            'status' => 'ready_for_pickup',
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

    public function test_assignment_sla_health_normal(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);

        $sla = app(DeliverySlaService::class);
        $this->assertEquals('normal', $sla->getAssignmentSlaHealth($order));
    }

    public function test_assignment_sla_health_warning(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        \DB::table('orders')->where('id', $order->id)->update(['updated_at' => now()->subMinutes(9)]); // 90% of 10 min SLA
        $order->refresh();

        $sla = app(DeliverySlaService::class);
        $this->assertEquals('warning', $sla->getAssignmentSlaHealth($order));
    }

    public function test_assignment_sla_health_critical(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        \DB::table('orders')->where('id', $order->id)->update(['updated_at' => now()->subMinutes(11)]); // Exceeded 10 min SLA
        $order->refresh();

        $sla = app(DeliverySlaService::class);
        $this->assertEquals('critical', $sla->getAssignmentSlaHealth($order));
    }

    public function test_pickup_sla_health_normal(): void
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

        $sla = app(DeliverySlaService::class);
        $this->assertEquals('normal', $sla->getPickupSlaHealth($delivery));
    }

    public function test_pickup_sla_health_warning(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'waiting_pickup',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subMinutes(17), // 85% of 20 min SLA
        ]);

        $sla = app(DeliverySlaService::class);
        $this->assertEquals('warning', $sla->getPickupSlaHealth($delivery));
    }

    public function test_pickup_sla_health_critical(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'waiting_pickup',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subMinutes(22), // Exceeded 20 min SLA
        ]);

        $sla = app(DeliverySlaService::class);
        $this->assertEquals('critical', $sla->getPickupSlaHealth($delivery));
    }

    public function test_delivery_sla_health_normal(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'delivering',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now(),
            'pickup_time' => now(),
        ]);

        $sla = app(DeliverySlaService::class);
        $this->assertEquals('normal', $sla->getDeliverySlaHealth($delivery));
    }

    public function test_delivery_sla_health_critical(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'delivering',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subMinutes(65),
            'pickup_time' => now()->subMinutes(65),
        ]);

        $sla = app(DeliverySlaService::class);
        $this->assertEquals('critical', $sla->getDeliverySlaHealth($delivery));
    }

    public function test_sla_config_is_respected(): void
    {
        config(['delivery.sla.assignment_sla_minutes' => 5]);

        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        \DB::table('orders')->where('id', $order->id)->update(['updated_at' => now()->subMinutes(5)]);
        $order->refresh();

        $sla = app(DeliverySlaService::class);
        $this->assertEquals('critical', $sla->getAssignmentSlaHealth($order));
    }

    public function test_count_overdue_includes_all_types(): void
    {
        $ctx = $this->makeContext();

        // Overdue assignment
        $order1 = $this->makeOrder($ctx);
        \DB::table('orders')->where('id', $order1->id)->update(['updated_at' => now()->subMinutes(15)]);

        // Overdue pickup
        $order2 = $this->makeOrder($ctx);
        Delivery::create([
            'order_id' => $order2->id,
            'courier_id' => $ctx['courier']->id,
            'status' => 'waiting_pickup',
            'assigned_by' => $ctx['owner']->id,
            'assigned_at' => now()->subMinutes(25),
        ]);

        $sla = app(DeliverySlaService::class);
        $this->assertGreaterThanOrEqual(2, $sla->countOverdue());
    }
}
