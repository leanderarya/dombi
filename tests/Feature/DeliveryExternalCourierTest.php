<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
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
}