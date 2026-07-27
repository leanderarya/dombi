<?php

namespace Tests\Feature;

use App\Models\Delivery;
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

        $this->assertAssignmentRejected(
            fn () => app(DeliveryService::class)->assignCourier($order, $courier, $operator),
            $order,
            'payment_status',
            'Pesanan harus sudah dibayar sebelum kurir dipilih.',
        );
    }

    public function test_unpaid_order_cannot_be_assigned_to_external_courier(): void
    {
        [$order, $operator] = $this->context('pending');

        $this->assertAssignmentRejected(
            fn () => app(DeliveryService::class)->assignCourier(
                order: $order,
                courier: null,
                assignedBy: $operator,
                courierType: 'eksternal',
                externalName: 'Budi',
                externalProvider: 'gojek',
                courierCost: 15000,
            ),
            $order,
            'payment_status',
            'Pesanan harus sudah dibayar sebelum kurir dipilih.',
        );
    }

    public function test_internal_assignment_requires_a_courier(): void
    {
        [$order, $operator] = $this->context('paid');

        $this->assertAssignmentRejected(
            fn () => app(DeliveryService::class)->assignCourier($order, null, $operator),
            $order,
            'courier_id',
            'Kurir wajib dipilih.',
        );
    }

    public function test_internal_assignment_uses_locked_courier_state(): void
    {
        [$order, $operator, $courier] = $this->context('paid');
        User::query()->whereKey($courier->id)->update(['is_online' => false]);

        $this->assertAssignmentRejected(
            fn () => app(DeliveryService::class)->assignCourier($order, $courier, $operator),
            $order,
            'courier_id',
            'Kurir sedang offline.',
        );
    }

    public function test_stale_paid_model_cannot_bypass_locked_internal_payment_check(): void
    {
        [$order, $operator, $courier] = $this->context('paid');
        Order::query()->whereKey($order->id)->update(['payment_status' => 'pending']);

        $this->assertAssignmentRejected(
            fn () => app(DeliveryService::class)->assignCourier($order, $courier, $operator),
            $order,
            'payment_status',
            'Pesanan harus sudah dibayar sebelum kurir dipilih.',
        );
    }

    public function test_stale_paid_model_cannot_bypass_locked_external_payment_check(): void
    {
        [$order, $operator] = $this->context('paid');
        Order::query()->whereKey($order->id)->update(['payment_status' => 'pending']);

        $this->assertAssignmentRejected(
            fn () => $this->assignExternal($order, $operator),
            $order,
            'payment_status',
            'Pesanan harus sudah dibayar sebelum kurir dipilih.',
        );
    }

    public function test_stale_delivery_model_cannot_assign_internal_courier_after_order_becomes_pickup(): void
    {
        [$order, $operator, $courier] = $this->context('paid');
        Order::query()->whereKey($order->id)->update(['fulfillment_type' => Order::FULFILLMENT_PICKUP]);

        $this->assertAssignmentRejected(
            fn () => app(DeliveryService::class)->assignCourier($order, $courier, $operator),
            $order,
            'fulfillment_type',
            'Pesanan pickup tidak memerlukan kurir.',
        );
    }

    public function test_stale_delivery_model_cannot_assign_external_courier_after_order_becomes_pickup(): void
    {
        [$order, $operator] = $this->context('paid');
        Order::query()->whereKey($order->id)->update(['fulfillment_type' => Order::FULFILLMENT_PICKUP]);

        $this->assertAssignmentRejected(
            fn () => $this->assignExternal($order, $operator),
            $order,
            'fulfillment_type',
            'Pesanan pickup tidak memerlukan kurir.',
        );
    }

    public function test_pickup_order_cannot_be_assigned(): void
    {
        [$order, $operator, $courier] = $this->context('paid', Order::FULFILLMENT_PICKUP);

        $this->assertAssignmentRejected(
            fn () => app(DeliveryService::class)->assignCourier($order, $courier, $operator),
            $order,
            'fulfillment_type',
            'Pesanan pickup tidak memerlukan kurir.',
        );
    }

    public function test_stale_dombi_model_cannot_bypass_locked_internal_ojol_check(): void
    {
        [$order, $operator, $courier] = $this->context('paid');
        Order::query()->whereKey($order->id)->update(['fulfillment_type' => Order::FULFILLMENT_DELIVERY_OJOL]);

        $this->assertAssignmentRejected(
            fn () => app(DeliveryService::class)->assignCourier($order, $courier, $operator),
            $order,
            'courier_id',
            'Pesanan delivery Ojol tidak bisa di-assign ke kurir internal.',
        );
    }

    public function test_internal_courier_cannot_be_assigned_to_ojol_order(): void
    {
        [$order, $operator, $courier] = $this->context('paid', Order::FULFILLMENT_DELIVERY_OJOL);

        $this->assertAssignmentRejected(
            fn () => app(DeliveryService::class)->assignCourier($order, $courier, $operator),
            $order,
            'courier_id',
            'Pesanan delivery Ojol tidak bisa di-assign ke kurir internal.',
        );
    }

    public function test_paid_ojol_order_can_be_assigned_to_external_courier(): void
    {
        [$order, $operator] = $this->context('paid', Order::FULFILLMENT_DELIVERY_OJOL);

        $delivery = $this->assignExternal($order, $operator);

        $this->assertSame('eksternal', $delivery->courier_type);
        $this->assertSame('waiting_pickup', $delivery->status);
    }

    public function test_unpaid_ojol_order_cannot_be_assigned_to_external_courier(): void
    {
        [$order, $operator] = $this->context('pending', Order::FULFILLMENT_DELIVERY_OJOL);

        $this->assertAssignmentRejected(
            fn () => $this->assignExternal($order, $operator),
            $order,
            'payment_status',
            'Pesanan harus sudah dibayar sebelum kurir dipilih.',
        );
    }

    public function test_paid_delivery_order_can_be_assigned(): void
    {
        [$order, $operator, $courier] = $this->context('paid');

        $delivery = app(DeliveryService::class)
            ->assignCourier($order, $courier, $operator);

        $this->assertSame('waiting_pickup', $delivery->status);
    }

    private function assignExternal(Order $order, User $operator): Delivery
    {
        return app(DeliveryService::class)->assignCourier(
            order: $order,
            courier: null,
            assignedBy: $operator,
            courierType: 'eksternal',
            externalName: 'Budi',
            externalProvider: 'gojek',
            courierCost: 15000,
        );
    }

    private function assertAssignmentRejected(
        callable $assignment,
        Order $order,
        string $field,
        string $message,
    ): void {
        try {
            $assignment();
            $this->fail('Expected courier assignment to be rejected.');
        } catch (ValidationException $exception) {
            $this->assertSame([$message], $exception->errors()[$field] ?? []);
        }

        $this->assertDatabaseMissing('deliveries', ['order_id' => $order->id]);
    }

    private function context(
        string $paymentStatus,
        string $fulfillmentType = Order::FULFILLMENT_DELIVERY_DOMBI,
    ): array
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

        if ($fulfillmentType === Order::FULFILLMENT_DELIVERY_DOMBI) {
            \App\Models\CourierProfile::create([
                'user_id' => $courier->id,
                'courier_source' => 'outlet',
                'outlet_id' => $outlet->id,
                'invitation_status' => 'accepted',
            ]);
        }

        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => $fulfillmentType,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => $paymentStatus,
        ]);

        return [$order, $operator, $courier];
    }
}
