<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\DeliveryStatusHistory;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\DeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryExternalCourierTest extends TestCase
{
    use RefreshDatabase;

    private User $outletStaff;
    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        $outlet = Outlet::create([
            'name' => 'Test Outlet',
            'address' => 'Jl. Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'latitude' => -6.2,
            'longitude' => 106.8,
            'status' => 'active',
        ]);
        $this->outletStaff = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);

        $this->order = Order::create([
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-EXT-001',
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'delivery_dombi',
            'payment_status' => 'paid',
            'subtotal' => 50000,
            'delivery_fee' => 15000,
            'total' => 65000,
            'customer_name' => 'Test',
            'customer_phone' => '081234567890',
            'customer_address' => 'Jl. Customer',
            'ordered_at' => now(),
        ]);
    }

    public function test_assign_eksternal_sets_delivery_status_delivering(): void
    {
        $response = $this->actingAs($this->outletStaff)
            ->post("/outlet/orders/{$this->order->id}/assign-courier", [
                'courier_type' => 'eksternal',
                'external_courier_name' => 'Gojek',
                'external_courier_phone' => '081111111',
                'external_plate_number' => 'B 1234 ABC',
                'courier_cost' => 25000,
            ]);

        $response->assertRedirect();
        $delivery = Delivery::where('order_id', $this->order->id)->first();

        $this->assertNotNull($delivery);
        $this->assertEquals('eksternal', $delivery->courier_type);
        $this->assertEquals('delivering', $delivery->status);
        $this->assertEquals('Gojek', $delivery->external_courier_name);
        $this->assertEquals(25000, (float) $delivery->courier_cost);

        $this->order->refresh();
        $this->assertEquals(Order::STATUS_DELIVERING, $this->order->status);
    }

    public function test_external_assignment_records_outlet_actor_and_timestamps(): void
    {
        $assignmentTime = now()->startOfSecond();
        $this->travelTo($assignmentTime);

        $delivery = $this->assignExternal($this->order, $this->outletStaff);
        $history = DeliveryStatusHistory::where('delivery_id', $delivery->id)->sole();

        $this->assertSame($this->outletStaff->id, $delivery->assigned_by);
        $this->assertNotNull($delivery->assigned_at);
        $this->assertTrue($delivery->assigned_at->equalTo($assignmentTime));
        $this->assertSame('outlet', $history->changed_by_type);
        $this->assertSame($this->outletStaff->id, $history->changed_by_id);
        $this->assertSame('delivering', $history->to_status);
        $this->assertNotNull($history->created_at);
        $this->assertTrue($history->created_at->equalTo($assignmentTime));
    }

    public function test_external_assignment_records_owner_actor_and_timestamps(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create([
            'outlet_id' => $this->outletStaff->outlet_id,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'payment_status' => 'paid',
        ]);
        $assignmentTime = now()->startOfSecond();
        $this->travelTo($assignmentTime);

        $delivery = $this->assignExternal($order, $owner);
        $history = DeliveryStatusHistory::where('delivery_id', $delivery->id)->sole();

        $this->assertSame($owner->id, $delivery->assigned_by);
        $this->assertNotNull($delivery->assigned_at);
        $this->assertTrue($delivery->assigned_at->equalTo($assignmentTime));
        $this->assertSame('owner', $history->changed_by_type);
        $this->assertSame($owner->id, $history->changed_by_id);
        $this->assertSame('delivering', $history->to_status);
        $this->assertNotNull($history->created_at);
        $this->assertTrue($history->created_at->equalTo($assignmentTime));
    }

    public function test_assign_eksternal_rejects_without_name(): void
    {
        $response = $this->actingAs($this->outletStaff)
            ->post("/outlet/orders/{$this->order->id}/assign-courier", [
                'courier_type' => 'eksternal',
                'courier_cost' => 25000,
            ]);

        $response->assertSessionHasErrors('external_courier_name');
    }

    public function test_assign_eksternal_rejects_without_cost(): void
    {
        $response = $this->actingAs($this->outletStaff)
            ->post("/outlet/orders/{$this->order->id}/assign-courier", [
                'courier_type' => 'eksternal',
                'external_courier_name' => 'Gojek',
            ]);

        $response->assertSessionHasErrors('courier_cost');
    }

    public function test_eksternal_delivery_can_be_marked_completed(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);

        $this->actingAs($this->outletStaff)
            ->post("/outlet/orders/{$this->order->id}/assign-courier", [
                'courier_type' => 'eksternal',
                'external_courier_name' => 'Gojek',
                'courier_cost' => 25000,
            ]);

        $delivery = Delivery::where('order_id', $this->order->id)->first();
        $delivery->update(['courier_id' => $courier->id]);

        $response = $this->actingAs($courier)
            ->post("/courier/deliveries/{$delivery->id}/complete", []);

        $response->assertRedirect();
        $delivery->refresh();
        $this->assertEquals('completed', $delivery->status);

        $this->order->refresh();
        $this->assertEquals(Order::STATUS_COMPLETED, $this->order->status);
    }

    private function assignExternal(Order $order, User $actor): Delivery
    {
        return app(DeliveryService::class)->assignCourier(
            order: $order,
            courier: null,
            assignedBy: $actor,
            courierType: 'eksternal',
            externalName: 'Gojek',
            courierCost: 25000,
        );
    }
}
