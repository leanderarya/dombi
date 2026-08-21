<?php

namespace Tests\Feature;

use App\Models\CourierProfile;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerAssignCourierFixTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_assign_dombi_courier_creates_delivery(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);

        $courierUser = User::factory()->create(['role' => 'courier']);
        $courierUser->update(['is_active' => true]);
        $courierUser->goOnline();

        $outlet = Outlet::factory()->create(['status' => 'active']);
        $outletUser = User::factory()->create(['role' => 'outlet']);
        $outletUser->update(['outlet_id' => $outlet->id]);

        CourierProfile::create([
            'user_id' => $courierUser->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => CourierProfile::STATUS_ACTIVE,
        ]);

        $customer = Customer::create(['name' => 'Test', 'phone' => '6281234567890'.rand(1000, 9999)]);
        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'ORD-'.strtoupper(substr(uniqid(), -6)),
            'status' => 'ready_for_pickup',
            'fulfillment_type' => 'delivery_dombi',
            'payment_status' => 'paid',
            'subtotal' => 25000,
            'delivery_fee' => 5000,
            'total' => 30000,
            'customer_name' => 'Budi',
            'customer_phone' => '08123456789',
            'customer_address' => 'Jl. Test',
            'latitude' => -6.21,
            'longitude' => 106.81,
            'ordered_at' => now(),
        ]);

        $response = $this->actingAs($owner)->post("/owner/orders/{$order->id}/assign-courier", [
            'courier_type' => 'dombi',
            'courier_id' => $courierUser->id,
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('deliveries', ['order_id' => $order->id]);
    }
}
