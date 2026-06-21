<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierDeliveryTest extends TestCase
{
    use RefreshDatabase;

    private User $courier;
    private Delivery $delivery;
    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();
        $this->courier = User::factory()->create(['role' => 'courier', 'is_online' => true]);

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

        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890'.rand(1000, 9999)]);

        $this->order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'ORD-'.strtoupper(substr(uniqid(), -6)),
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

        $this->delivery = Delivery::create([
            'order_id' => $this->order->id,
            'courier_id' => $this->courier->id,
            'status' => 'waiting_pickup',
            'assigned_at' => now(),
        ]);
    }

    public function test_delivery_index_loads(): void
    {
        $response = $this->actingAs($this->courier)->get('/courier/deliveries');
        $response->assertStatus(200);
    }

    public function test_delivery_show_loads(): void
    {
        $response = $this->actingAs($this->courier)->get("/courier/deliveries/{$this->delivery->id}");
        $response->assertStatus(200);
    }

    public function test_confirm_pickup(): void
    {
        $response = $this->actingAs($this->courier)->post("/courier/deliveries/{$this->delivery->id}/confirm-pickup");
        $response->assertRedirect();
        $this->delivery->refresh();
        $this->assertEquals('picked_up', $this->delivery->status);
    }

    public function test_start_delivery(): void
    {
        $this->delivery->update(['status' => 'picked_up']);
        $this->order->update(['status' => 'picked_up']);

        $response = $this->actingAs($this->courier)->post("/courier/deliveries/{$this->delivery->id}/start-delivery");
        $response->assertRedirect();
        $this->delivery->refresh();
        $this->assertEquals('delivering', $this->delivery->status);
    }

    public function test_complete_delivery(): void
    {
        $this->delivery->update(['status' => 'delivering']);
        $this->order->update(['status' => 'delivering']);

        $response = $this->actingAs($this->courier)->post("/courier/deliveries/{$this->delivery->id}/complete", [
            'delivered_to' => 'John Doe',
            'delivery_note' => 'Left at front door',
        ]);
        $response->assertRedirect();
        $this->delivery->refresh();
        $this->assertEquals('completed', $this->delivery->status);
    }

    public function test_fail_delivery(): void
    {
        $this->delivery->update(['status' => 'delivering']);
        $this->order->update(['status' => 'delivering']);

        $response = $this->actingAs($this->courier)->post("/courier/deliveries/{$this->delivery->id}/fail", [
            'failed_reason' => 'Customer Tidak Ditemukan',
        ]);
        $response->assertRedirect();
        $this->delivery->refresh();
        $this->assertEquals('failed', $this->delivery->status);
    }

    public function test_reject_delivery(): void
    {
        $response = $this->actingAs($this->courier)->post("/courier/deliveries/{$this->delivery->id}/reject", [
            'rejection_reason' => 'Kendala Pribadi',
        ]);
        $response->assertRedirect();
        $this->delivery->refresh();
        $this->assertEquals('rejected_by_courier', $this->delivery->status);
    }
}
