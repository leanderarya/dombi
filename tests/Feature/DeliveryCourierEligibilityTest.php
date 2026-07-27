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
