<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Delivery;
use App\Models\DeliveryStatusHistory;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\DeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DeliverySafetyTest extends TestCase
{
    use RefreshDatabase;

    private function makeContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'is_online' => true]);
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true, 'is_online' => true]);
        $courier2 = User::factory()->create(['role' => 'courier', 'is_active' => true, 'is_online' => true]);
        $customer = Customer::create(['name' => 'Budi', 'phone' => '6281234567890']);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -6.2,
            'longitude' => 106.8,
            'phone' => '08123456789',
            'status' => 'active',
        ]);
        $outletUser->update(['outlet_id' => $outlet->id]);

        return compact('owner', 'courier', 'courier2', 'customer', 'outlet', 'outletUser');
    }

    private function makeOrder(array $ctx): Order
    {
        return Order::create([
            'customer_id' => $ctx['customer']->id,
            'outlet_id' => $ctx['outlet']->id,
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
    }

    // ─── COURIER REJECTION ──────────────────────────────────────────

    public function test_courier_can_reject_assignment(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);

        $this->actingAs($ctx['courier'])
            ->post(route('courier.deliveries.reject', $delivery), [
                'rejection_reason' => 'Kendaraan Bermasalah',
            ])
            ->assertRedirect();

        $delivery->refresh();
        $this->assertEquals('rejected_by_courier', $delivery->status);
        $this->assertEquals('Kendaraan Bermasalah', $delivery->rejection_reason);
        $this->assertNotNull($delivery->rejected_at);

        $order->refresh();
        $this->assertEquals('ready_for_pickup', $order->status);
    }

    public function test_rejection_creates_audit_history(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);

        $this->actingAs($ctx['courier'])
            ->post(route('courier.deliveries.reject', $delivery), [
                'rejection_reason' => 'Kendala Pribadi',
            ]);

        $this->assertDatabaseHas('delivery_status_histories', [
            'delivery_id' => $delivery->id,
            'from_status' => 'waiting_pickup',
            'to_status' => 'rejected_by_courier',
            'changed_by_type' => 'courier',
        ]);
    }

    public function test_rejection_with_lainnya_requires_note(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);

        $this->actingAs($ctx['courier'])
            ->post(route('courier.deliveries.reject', $delivery), [
                'rejection_reason' => 'Lainnya',
            ])
            ->assertSessionHasErrors('rejection_note');
    }

    public function test_rejected_delivery_allows_reassignment(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);

        $this->actingAs($ctx['courier'])
            ->post(route('courier.deliveries.reject', $delivery), [
                'rejection_reason' => 'Sedang Mengantar Pesanan Lain',
            ]);

        $order->refresh();
        $this->assertEquals('ready_for_pickup', $order->status);

        // Can reassign to another courier
        $delivery2 = app(DeliveryService::class)->assignCourier($order->fresh(), $ctx['courier2'], $ctx['owner']);
        $this->assertNotNull($delivery2);
        $this->assertEquals($ctx['courier2']->id, $delivery2->courier_id);
    }

    // ─── CAPACITY LIMIT ─────────────────────────────────────────────

    public function test_assignment_blocked_when_courier_at_capacity(): void
    {
        config(['delivery.capacity.max_active_deliveries' => 2]);
        $ctx = $this->makeContext();

        // Create 2 active deliveries
        for ($i = 0; $i < 2; $i++) {
            $order = $this->makeOrder($ctx);
            app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);
        }

        // Third should fail
        $order3 = $this->makeOrder($ctx);

        $this->expectException(ValidationException::class);
        app(DeliveryService::class)->assignCourier($order3, $ctx['courier'], $ctx['owner']);
    }

    public function test_assignment_with_override_bypasses_capacity(): void
    {
        config(['delivery.capacity.max_active_deliveries' => 2]);
        $ctx = $this->makeContext();

        for ($i = 0; $i < 2; $i++) {
            $order = $this->makeOrder($ctx);
            app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);
        }

        $order3 = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order3, $ctx['courier'], $ctx['owner'], true, 'Urgent delivery');

        $this->assertNotNull($delivery);
    }

    public function test_assignment_blocked_for_offline_courier(): void
    {
        $ctx = $this->makeContext();
        $ctx['courier']->forceFill(['is_online' => false])->save();
        $order = $this->makeOrder($ctx);

        $this->expectException(ValidationException::class);
        app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);
    }

    // ─── RETURN TO OUTLET ───────────────────────────────────────────

    public function test_courier_can_return_failed_delivery_to_outlet(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);
        app(DeliveryService::class)->confirmPickup($delivery, $ctx['courier']);
        app(DeliveryService::class)->startDelivery($delivery->fresh(), $ctx['courier']);
        app(DeliveryService::class)->failDelivery($delivery->fresh(), $ctx['courier'], 'Customer Tidak Ditemukan');

        $this->actingAs($ctx['courier'])
            ->post(route('courier.deliveries.return-to-outlet', $delivery->fresh()), [
                'return_note' => 'Mengembalikan ke outlet',
            ])
            ->assertRedirect();

        $delivery->refresh();
        $this->assertEquals('returning_to_outlet', $delivery->return_status);
    }

    public function test_outlet_can_confirm_return_receipt(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);
        app(DeliveryService::class)->confirmPickup($delivery, $ctx['courier']);
        app(DeliveryService::class)->startDelivery($delivery->fresh(), $ctx['courier']);
        app(DeliveryService::class)->failDelivery($delivery->fresh(), $ctx['courier'], 'Alamat Tidak Jelas');
        app(DeliveryService::class)->returnToOutlet($delivery->fresh(), $ctx['courier'], 'Returning');

        $this->actingAs($ctx['outletUser'])
            ->post(route('outlet.deliveries.confirm-return', $delivery->fresh()), [
                'return_note' => 'Barang diterima kembali',
            ])
            ->assertRedirect();

        $delivery->refresh();
        $this->assertEquals('returned_to_outlet', $delivery->return_status);
        $this->assertNotNull($delivery->return_confirmed_by);
        $this->assertNotNull($delivery->return_confirmed_at);
    }

    public function test_return_creates_audit_history(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);
        app(DeliveryService::class)->confirmPickup($delivery, $ctx['courier']);
        app(DeliveryService::class)->startDelivery($delivery->fresh(), $ctx['courier']);
        app(DeliveryService::class)->failDelivery($delivery->fresh(), $ctx['courier'], 'Gagal');
        app(DeliveryService::class)->returnToOutlet($delivery->fresh(), $ctx['courier']);
        app(DeliveryService::class)->confirmReturn($delivery->fresh(), $ctx['outletUser']);

        $histories = DeliveryStatusHistory::where('delivery_id', $delivery->id)->get();
        $statuses = $histories->pluck('to_status')->toArray();

        $this->assertContains('returning_to_outlet', $statuses);
        $this->assertContains('returned_to_outlet', $statuses);
    }

    // ─── IDEMPOTENCY ────────────────────────────────────────────────

    public function test_cannot_complete_already_completed_delivery(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);
        app(DeliveryService::class)->confirmPickup($delivery, $ctx['courier']);
        app(DeliveryService::class)->startDelivery($delivery->fresh(), $ctx['courier']);
        app(DeliveryService::class)->completeDelivery($delivery->fresh(), $ctx['courier']);

        $this->expectException(ValidationException::class);
        app(DeliveryService::class)->completeDelivery($delivery->fresh(), $ctx['courier']);
    }

    public function test_cannot_fail_already_completed_delivery(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);
        app(DeliveryService::class)->confirmPickup($delivery, $ctx['courier']);
        app(DeliveryService::class)->startDelivery($delivery->fresh(), $ctx['courier']);
        app(DeliveryService::class)->completeDelivery($delivery->fresh(), $ctx['courier']);

        $this->expectException(ValidationException::class);
        app(DeliveryService::class)->failDelivery($delivery->fresh(), $ctx['courier'], 'Gagal');
    }

    // ─── ACTIVITY TRACKING ──────────────────────────────────────────

    public function test_pickup_records_courier_activity(): void
    {
        $ctx = $this->makeContext();
        $order = $this->makeOrder($ctx);
        $delivery = app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);

        app(DeliveryService::class)->confirmPickup($delivery, $ctx['courier']);

        $ctx['courier']->refresh();
        $this->assertNotNull($ctx['courier']->last_activity_at);
        $this->assertTrue($ctx['courier']->last_activity_at->isAfter(now()->subMinutes(1)));
    }

    // ─── AUTO OFFLINE ───────────────────────────────────────────────

    public function test_auto_offline_command(): void
    {
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
            'last_activity_at' => now()->subHours(5),
        ]);

        $this->artisan('couriers:auto-offline');

        $courier->refresh();
        $this->assertFalse($courier->is_online);
    }

    public function test_auto_offline_skips_courier_with_active_deliveries(): void
    {
        $ctx = $this->makeContext();
        $ctx['courier']->update(['last_activity_at' => now()->subHours(5)]);

        $order = $this->makeOrder($ctx);
        app(DeliveryService::class)->assignCourier($order, $ctx['courier'], $ctx['owner']);

        $this->artisan('couriers:auto-offline');

        $ctx['courier']->refresh();
        $this->assertTrue($ctx['courier']->is_online);
    }

    // ─── DELIVERY CAPACITY METHOD ───────────────────────────────────

    public function test_courier_active_delivery_count(): void
    {
        $ctx = $this->makeContext();
        $service = app(DeliveryService::class);

        $this->assertEquals(0, $service->getCourierActiveDeliveryCount($ctx['courier']));

        $order1 = $this->makeOrder($ctx);
        $service->assignCourier($order1, $ctx['courier'], $ctx['owner']);
        $this->assertEquals(1, $service->getCourierActiveDeliveryCount($ctx['courier']));

        $order2 = $this->makeOrder($ctx);
        $service->assignCourier($order2, $ctx['courier'], $ctx['owner']);
        $this->assertEquals(2, $service->getCourierActiveDeliveryCount($ctx['courier']));
    }
}
