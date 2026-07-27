<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\DeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DeliveryAssignmentLaunchGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_unpaid_order_cannot_be_assigned_to_dombi_courier(): void
    {
        [$order, $operator, $courier] = $this->context('pending');

        $this->expectException(ValidationException::class);

        app(DeliveryService::class)->assignCourier($order, $courier, $operator);
    }

    public function test_unpaid_order_cannot_be_assigned_to_external_courier(): void
    {
        [$order, $operator] = $this->context('pending');

        $this->expectException(ValidationException::class);

        app(DeliveryService::class)->assignCourier(
            order: $order,
            courier: null,
            assignedBy: $operator,
            courierType: 'eksternal',
            externalName: 'Budi',
            courierCost: 15000,
        );
    }

    public function test_paid_delivery_order_can_be_assigned(): void
    {
        [$order, $operator, $courier] = $this->context('paid');

        $delivery = app(DeliveryService::class)
            ->assignCourier($order, $courier, $operator);

        $this->assertSame('waiting_pickup', $delivery->status);
    }

    private function context(string $paymentStatus): array
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
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => $paymentStatus,
        ]);

        return [$order, $operator, $courier];
    }
}
