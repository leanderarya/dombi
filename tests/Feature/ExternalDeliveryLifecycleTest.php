<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExternalDeliveryLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_external_assignment_starts_waiting_for_pickup(): void
    {
        [$operator, $order] = $this->context();

        $this->actingAs($operator)->post(
            "/outlet/orders/{$order->id}/assign-courier",
            $this->externalPayload()
        )->assertRedirect();

        $delivery = Delivery::where('order_id', $order->id)->firstOrFail();

        $this->assertSame('waiting_pickup', $delivery->status);
        $this->assertSame(Order::STATUS_READY_FOR_PICKUP, $order->fresh()->status);
    }

    public function test_outlet_operator_can_complete_external_lifecycle(): void
    {
        [$operator, $order] = $this->context();
        $this->actingAs($operator)->post(
            "/outlet/orders/{$order->id}/assign-courier",
            $this->externalPayload()
        );
        $delivery = Delivery::where('order_id', $order->id)->firstOrFail();

        foreach (['picked_up', 'delivering', 'completed'] as $status) {
            $this->actingAs($operator)
                ->post("/outlet/deliveries/{$delivery->id}/status", ['status' => $status])
                ->assertRedirect();
        }

        $this->assertSame('completed', $delivery->fresh()->status);
        $this->assertSame(Order::STATUS_COMPLETED, $order->fresh()->status);
    }

    public function test_external_failure_requires_reason(): void
    {
        [$operator, $order] = $this->context();
        $this->actingAs($operator)->post(
            "/outlet/orders/{$order->id}/assign-courier",
            $this->externalPayload()
        );
        $delivery = Delivery::where('order_id', $order->id)->firstOrFail();
        $delivery->update(['status' => 'delivering']);
        $order->update(['status' => Order::STATUS_DELIVERING]);

        $this->actingAs($operator)
            ->post("/outlet/deliveries/{$delivery->id}/status", ['status' => 'failed'])
            ->assertSessionHasErrors('reason');
    }

    public function test_failed_external_delivery_can_be_returned_to_outlet(): void
    {
        [$operator, $order] = $this->context();
        $this->actingAs($operator)->post(
            "/outlet/orders/{$order->id}/assign-courier",
            $this->externalPayload()
        );
        $delivery = Delivery::where('order_id', $order->id)->firstOrFail();
        $delivery->update(['status' => 'failed', 'failed_reason' => 'Alamat tidak ditemukan']);
        $order->update(['status' => Order::STATUS_FAILED_DELIVERY]);

        $this->actingAs($operator)->post(
            "/outlet/deliveries/{$delivery->id}/status",
            [
                'status' => 'returned_to_outlet',
                'reason' => 'Barang sudah kembali dan diterima outlet.',
            ],
        )->assertRedirect();

        $this->assertSame('returned_to_outlet', $delivery->fresh()->status);
        $this->assertSame(Order::STATUS_PREPARING, $order->fresh()->status);
    }

    public function test_other_outlet_cannot_mutate_external_delivery(): void
    {
        [$operator, $order] = $this->context();
        $this->actingAs($operator)->post(
            "/outlet/orders/{$order->id}/assign-courier",
            $this->externalPayload()
        );
        $delivery = Delivery::where('order_id', $order->id)->firstOrFail();
        $other = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => Outlet::factory()->create()->id,
        ]);

        $this->actingAs($other)
            ->post("/outlet/deliveries/{$delivery->id}/status", ['status' => 'picked_up'])
            ->assertForbidden();
    }

    private function context(): array
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        return [$operator, $order];
    }

    private function externalPayload(): array
    {
        return [
            'courier_type' => 'eksternal',
            'external_provider' => 'gojek',
            'external_courier_name' => 'Budi',
            'courier_cost' => 15000,
        ];
    }
}
