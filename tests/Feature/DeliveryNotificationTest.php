<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use App\Services\DeliveryService;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function makeContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true, 'is_online' => true]);
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890'.rand(1000, 9999)]);
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
        $product = Product::create([
            'name' => 'Nasi Goreng',
            'slug' => 'nasi-goreng-'.uniqid(),
            'price' => 25000,
            'is_active' => true,
        ]);
        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 100,
            'reserved_stock' => 1,
            'minimum_stock' => 10,
        ]);
        $order = Order::create([
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

        return compact('owner', 'courier', 'customer', 'outlet', 'product', 'order');
    }

    public function test_start_delivery_notifies_customer(): void
    {
        $ctx = $this->makeContext();
        $deliveryService = app(DeliveryService::class);

        $delivery = $deliveryService->assignCourier($ctx['order'], $ctx['courier'], $ctx['owner']);
        $delivery = $deliveryService->confirmPickup($delivery, $ctx['courier']);
        $delivery = $deliveryService->startDelivery($delivery, $ctx['courier']);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'customer',
            'customer_id' => $ctx['customer']->id,
            'type' => NotificationService::DELIVERY_OUT_FOR_DELIVERY,
        ]);
    }
}
