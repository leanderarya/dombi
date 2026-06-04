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
use Tests\TestCase;

class DeliveryStatusHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function makeContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true, 'is_online' => true]);
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890' . rand(1000, 9999)]);
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
        $product = \App\Models\Product::create([
            'name' => 'Nasi Goreng',
            'slug' => 'nasi-goreng-' . uniqid(),
            'price' => 25000,
            'is_active' => true,
        ]);
        \App\Models\OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 100,
            'reserved_stock' => 1,
            'minimum_stock' => 10,
        ]);
        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'ORD-' . strtoupper(substr(uniqid(), -6)),
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

        return compact('owner', 'courier', 'customer', 'outlet', 'product', 'order');
    }

    public function test_assignment_creates_status_history(): void
    {
        $ctx = $this->makeContext();
        $deliveryService = app(DeliveryService::class);

        $delivery = $deliveryService->assignCourier($ctx['order'], $ctx['courier'], $ctx['owner']);

        $this->assertDatabaseHas('delivery_status_histories', [
            'delivery_id' => $delivery->id,
            'to_status' => 'waiting_pickup',
            'changed_by_type' => 'owner',
            'changed_by_id' => $ctx['owner']->id,
        ]);
    }

    public function test_pickup_creates_status_history(): void
    {
        $ctx = $this->makeContext();
        $deliveryService = app(DeliveryService::class);

        $delivery = $deliveryService->assignCourier($ctx['order'], $ctx['courier'], $ctx['owner']);
        $delivery = $deliveryService->confirmPickup($delivery, $ctx['courier']);

        $this->assertDatabaseHas('delivery_status_histories', [
            'delivery_id' => $delivery->id,
            'from_status' => 'waiting_pickup',
            'to_status' => 'picked_up',
            'changed_by_type' => 'courier',
        ]);
    }

    public function test_delivery_start_creates_status_history(): void
    {
        $ctx = $this->makeContext();
        $deliveryService = app(DeliveryService::class);

        $delivery = $deliveryService->assignCourier($ctx['order'], $ctx['courier'], $ctx['owner']);
        $delivery = $deliveryService->confirmPickup($delivery, $ctx['courier']);
        $delivery = $deliveryService->startDelivery($delivery, $ctx['courier']);

        $this->assertDatabaseHas('delivery_status_histories', [
            'delivery_id' => $delivery->id,
            'from_status' => 'picked_up',
            'to_status' => 'delivering',
            'changed_by_type' => 'courier',
        ]);
    }

    public function test_completion_creates_status_history(): void
    {
        $ctx = $this->makeContext();
        $deliveryService = app(DeliveryService::class);

        $delivery = $deliveryService->assignCourier($ctx['order'], $ctx['courier'], $ctx['owner']);
        $delivery = $deliveryService->confirmPickup($delivery, $ctx['courier']);
        $delivery = $deliveryService->startDelivery($delivery, $ctx['courier']);
        $delivery = $deliveryService->completeDelivery($delivery, $ctx['courier']);

        $this->assertDatabaseHas('delivery_status_histories', [
            'delivery_id' => $delivery->id,
            'from_status' => 'delivering',
            'to_status' => 'completed',
            'changed_by_type' => 'courier',
        ]);
    }

    public function test_failure_creates_status_history(): void
    {
        $ctx = $this->makeContext();
        $deliveryService = app(DeliveryService::class);

        $delivery = $deliveryService->assignCourier($ctx['order'], $ctx['courier'], $ctx['owner']);
        $delivery = $deliveryService->confirmPickup($delivery, $ctx['courier']);
        $delivery = $deliveryService->startDelivery($delivery, $ctx['courier']);
        $delivery = $deliveryService->failDelivery($delivery, $ctx['courier'], 'Alamat tidak ditemukan');

        $this->assertDatabaseHas('delivery_status_histories', [
            'delivery_id' => $delivery->id,
            'from_status' => 'delivering',
            'to_status' => 'failed',
            'changed_by_type' => 'courier',
            'reason' => 'Alamat tidak ditemukan',
        ]);
    }

    public function test_resolution_creates_status_history(): void
    {
        $ctx = $this->makeContext();
        $deliveryService = app(DeliveryService::class);

        $delivery = $deliveryService->assignCourier($ctx['order'], $ctx['courier'], $ctx['owner']);
        $delivery = $deliveryService->confirmPickup($delivery, $ctx['courier']);
        $delivery = $deliveryService->startDelivery($delivery, $ctx['courier']);
        $delivery = $deliveryService->failDelivery($delivery, $ctx['courier'], 'Gagal kirim');
        $delivery = $deliveryService->resolveFailedDelivery($delivery, $ctx['owner'], 'returned_to_outlet', 'Barang kembali');

        $this->assertDatabaseHas('delivery_status_histories', [
            'delivery_id' => $delivery->id,
            'from_status' => 'failed',
            'to_status' => 'returned_to_outlet',
            'changed_by_type' => 'owner',
        ]);
    }

    public function test_full_lifecycle_creates_all_histories(): void
    {
        $ctx = $this->makeContext();
        $deliveryService = app(DeliveryService::class);

        $delivery = $deliveryService->assignCourier($ctx['order'], $ctx['courier'], $ctx['owner']);
        $delivery = $deliveryService->confirmPickup($delivery, $ctx['courier']);
        $delivery = $deliveryService->startDelivery($delivery, $ctx['courier']);
        $delivery = $deliveryService->completeDelivery($delivery, $ctx['courier']);

        $histories = DeliveryStatusHistory::where('delivery_id', $delivery->id)->orderBy('created_at')->get();

        $this->assertCount(4, $histories);
        $this->assertEquals('waiting_pickup', $histories[0]->to_status);
        $this->assertEquals('picked_up', $histories[1]->to_status);
        $this->assertEquals('delivering', $histories[2]->to_status);
        $this->assertEquals('completed', $histories[3]->to_status);
    }

    public function test_outlet_assignment_creates_correct_actor_type(): void
    {
        $ctx = $this->makeContext();
        $outletUser = User::factory()->create(['role' => 'outlet', 'outlet_id' => $ctx['outlet']->id]);
        $deliveryService = app(DeliveryService::class);

        $delivery = $deliveryService->assignCourier($ctx['order'], $ctx['courier'], $outletUser);

        $this->assertDatabaseHas('delivery_status_histories', [
            'delivery_id' => $delivery->id,
            'to_status' => 'waiting_pickup',
            'changed_by_type' => 'outlet',
            'changed_by_id' => $outletUser->id,
        ]);
    }
}
