<?php

namespace Tests\Feature;

use App\Models\CourierProfile;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\DeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DeliveryCourierEligibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_outlet_cannot_assign_courier_from_another_outlet(): void
    {
        $firstOutlet = Outlet::factory()->create();
        $secondOutlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $firstOutlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);
        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $secondOutlet->id,
            'invitation_status' => 'accepted',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $firstOutlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        $this->expectException(ValidationException::class);

        app(DeliveryService::class)->assignCourier($order, $courier, $operator);
    }

    public function test_outlet_can_assign_accepted_courier_for_its_outlet(): void
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);
        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => 'accepted',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        $delivery = app(DeliveryService::class)
            ->assignCourier($order, $courier, $operator);

        $this->assertSame($courier->id, $delivery->courier_id);
    }

    public function test_outlet_assign_courier_endpoint_requires_courier_type(): void
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);
        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => 'accepted',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        $this->actingAs($operator)
            ->post("/outlet/orders/{$order->id}/assign-courier", [
                'courier_id' => $courier->id,
            ])
            ->assertSessionHasErrors('courier_type');
    }

    public function test_outlet_assign_courier_endpoint_succeeds_with_valid_internal_courier(): void
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);
        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => 'accepted',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        $this->actingAs($operator)
            ->post("/outlet/orders/{$order->id}/assign-courier", [
                'courier_type' => 'dombi',
                'courier_id' => $courier->id,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('deliveries', [
            'order_id' => $order->id,
            'courier_id' => $courier->id,
        ]);
    }

    public function test_outlet_assign_courier_endpoint_rejects_offline_courier(): void
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => false,
        ]);
        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => 'accepted',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        $this->actingAs($operator)
            ->from("/outlet/orders/{$order->id}")
            ->post("/outlet/orders/{$order->id}/assign-courier", [
                'courier_type' => 'dombi',
                'courier_id' => $courier->id,
            ])
            ->assertRedirect("/outlet/orders/{$order->id}")
            ->assertSessionHasErrors('courier_id');
    }

    public function test_outlet_order_page_only_lists_plotted_or_owned_accepted_couriers(): void
    {
        $outlet = Outlet::factory()->create();
        $otherOutlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);

        $ownedCourier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
            'name' => 'Owned Courier',
        ]);
        CourierProfile::create([
            'user_id' => $ownedCourier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => 'accepted',
        ]);

        $plottedCourier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
            'name' => 'Plotted Courier',
        ]);
        $plottedProfile = CourierProfile::create([
            'user_id' => $plottedCourier->id,
            'courier_source' => 'pusat',
            'invitation_status' => 'accepted',
        ]);
        $plottedProfile->assignedOutlets()->attach($outlet->id);

        $foreignCourier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
            'name' => 'Foreign Courier',
        ]);
        CourierProfile::create([
            'user_id' => $foreignCourier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $otherOutlet->id,
            'invitation_status' => 'accepted',
        ]);

        $unplottedPusatCourier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
            'name' => 'Unplotted Courier',
        ]);
        CourierProfile::create([
            'user_id' => $unplottedPusatCourier->id,
            'courier_source' => 'pusat',
            'invitation_status' => 'accepted',
        ]);

        $pendingCourier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
            'name' => 'Pending Courier',
        ]);
        CourierProfile::create([
            'user_id' => $pendingCourier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => 'pending',
        ]);

        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        $this->actingAs($operator)
            ->get("/outlet/orders/{$order->id}")
            ->assertInertia(fn ($page) => $page
                ->component('outlet/orders/show')
                ->has('couriers', 2)
                ->where('couriers.0.name', 'Owned Courier')
                ->where('couriers.0.is_online', true)
                ->where('couriers.0.at_capacity', false)
                ->missing('couriers.0.invitation_accepted')
                ->where('couriers.1.name', 'Plotted Courier')
                ->where('couriers.1.is_online', true)
                ->where('couriers.1.at_capacity', false)
                ->missing('couriers.1.invitation_accepted'));
    }

    public function test_outlet_order_page_keeps_offline_eligible_courier_visible(): void
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $offlineCourier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => false,
            'name' => 'Offline Courier',
        ]);
        CourierProfile::create([
            'user_id' => $offlineCourier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => 'accepted',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        $this->actingAs($operator)
            ->get("/outlet/orders/{$order->id}")
            ->assertInertia(fn ($page) => $page
                ->component('outlet/orders/show')
                ->has('couriers', 1)
                ->where('couriers.0.name', 'Offline Courier')
                ->where('couriers.0.is_online', false));
    }

    public function test_outlet_order_page_keeps_at_capacity_eligible_courier_visible(): void
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
            'name' => 'Busy Courier',
        ]);
        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => 'accepted',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);
        Order::factory()->count(3)->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_DELIVERING,
            'payment_status' => 'paid',
        ])->each(function (Order $deliveryOrder) use ($courier, $operator): void {
            $deliveryOrder->delivery()->create([
                'courier_id' => $courier->id,
                'status' => 'delivering',
                'assigned_by' => $operator->id,
                'assigned_at' => now(),
            ]);
        });

        $this->actingAs($operator)
            ->get("/outlet/orders/{$order->id}")
            ->assertInertia(fn ($page) => $page
                ->component('outlet/orders/show')
                ->has('couriers', 1)
                ->where('couriers.0.name', 'Busy Courier')
                ->where('couriers.0.at_capacity', true));
    }

    public function test_unaccepted_courier_cannot_be_assigned(): void
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);
        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => 'pending',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        $this->expectException(ValidationException::class);

        app(DeliveryService::class)->assignCourier($order, $courier, $operator);
    }
}
