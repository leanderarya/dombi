<?php

namespace Tests\Feature;

use App\Models\CourierProfile;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A courier holding a task may not go offline.
 *
 * The outlet finds couriers through is_online, and location tracking stops the
 * moment it drops — so going offline mid-delivery hides the courier while the
 * task is still open. User::hasActiveDeliveries() was written for this gate and
 * then never called.
 */
class CourierAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    private function courierWithDelivery(string $deliveryStatus, string $orderStatus = 'ready_for_pickup'): array
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890'.rand(1000, 9999),
        ]);
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

        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => CourierProfile::STATUS_ACTIVE,
        ]);

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'ORD-'.strtoupper(substr(uniqid(), -6)),
            'status' => $orderStatus,
            'fulfillment_type' => 'delivery_dombi',
            'payment_status' => 'paid',
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

        $delivery = Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $courier->id,
            'status' => $deliveryStatus,
            'assigned_at' => now(),
        ]);

        return compact('courier', 'order', 'delivery', 'outlet');
    }

    /** Every status that counts as an open task blocks the offline toggle. */
    public function test_a_courier_holding_an_active_delivery_cannot_go_offline(): void
    {
        foreach (['waiting_pickup', 'picked_up', 'delivering'] as $status) {
            $ctx = $this->courierWithDelivery($status);

            $response = $this->actingAs($ctx['courier'])
                ->post('/courier/availability/toggle');

            $response->assertRedirect();
            $response->assertSessionHasErrors('availability');

            $this->assertTrue(
                $ctx['courier']->fresh()->is_online,
                "Courier went offline while holding a {$status} delivery."
            );
        }
    }

    /** With nothing open there is no reason to hold the courier online. */
    public function test_a_courier_without_active_deliveries_can_go_offline(): void
    {
        $ctx = $this->courierWithDelivery('completed', 'completed');

        $response = $this->actingAs($ctx['courier'])
            ->post('/courier/availability/toggle');

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertFalse($ctx['courier']->fresh()->is_online);
    }

    /** A finished delivery is history, not an open task. */
    public function test_a_finished_delivery_does_not_block_going_offline(): void
    {
        foreach (['completed', 'failed', 'cancelled_and_released'] as $status) {
            $ctx = $this->courierWithDelivery($status, 'completed');

            $this->actingAs($ctx['courier'])->post('/courier/availability/toggle');

            $this->assertFalse(
                $ctx['courier']->fresh()->is_online,
                "A {$status} delivery wrongly kept the courier online."
            );
        }
    }

    /** The guard must not stand in the way of coming back online. */
    public function test_an_offline_courier_with_an_active_delivery_can_still_go_online(): void
    {
        $ctx = $this->courierWithDelivery('picked_up');
        $ctx['courier']->goOffline();

        $response = $this->actingAs($ctx['courier'])
            ->post('/courier/availability/toggle');

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertTrue($ctx['courier']->fresh()->is_online);
    }

    /** Another courier's task says nothing about this one's shift. */
    public function test_another_couriers_delivery_does_not_block_going_offline(): void
    {
        $ctx = $this->courierWithDelivery('picked_up');

        $other = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);

        $this->actingAs($other)->post('/courier/availability/toggle');

        $this->assertFalse($other->fresh()->is_online);
        $this->assertTrue($ctx['courier']->fresh()->is_online);
    }
}
