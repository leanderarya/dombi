<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Delivery;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\DeliveryService;
use App\Services\OrderService;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MilestoneThirdTest extends TestCase
{
    use RefreshDatabase;

    public function test_delivery_can_be_assigned_and_completed_with_stock_commit(): void
    {
        $context = $this->makeReadyForPickupOrder(quantity: 2);

        $delivery = app(DeliveryService::class)->assignCourier($context['order'], $context['courier'], $context['owner']);
        $this->assertSame('waiting_pickup', $delivery->status);

        $this->actingAs($context['courier'])
            ->post(route('courier.deliveries.confirm-pickup', $delivery))
            ->assertRedirect(route('courier.deliveries.show', $delivery));
        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'picked_up']);
        $this->assertDatabaseHas('deliveries', ['id' => $delivery->id, 'status' => 'picked_up']);

        $this->actingAs($context['courier'])
            ->post(route('courier.deliveries.start-delivery', $delivery))
            ->assertRedirect(route('courier.deliveries.show', $delivery));
        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'delivering']);

        $this->actingAs($context['courier'])
            ->post(route('courier.deliveries.complete', $delivery))
            ->assertRedirect(route('courier.deliveries.show', $delivery));

        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->firstOrFail();

        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'completed']);
        $this->assertDatabaseHas('deliveries', ['id' => $delivery->id, 'status' => 'completed']);
        $this->assertSame(8, $inventory->current_stock);
        $this->assertSame(0, $inventory->reserved_stock);
        $this->assertTrue(StockMovement::where('reference_id', $context['order']->id)->where('type', 'order_completed')->exists());
    }

    public function test_delivery_can_fail_without_releasing_reserved_stock(): void
    {
        $context = $this->makeReadyForPickupOrder(quantity: 1);
        $delivery = app(DeliveryService::class)->assignCourier($context['order'], $context['courier'], $context['owner']);
        app(DeliveryService::class)->confirmPickup($delivery, $context['courier']);
        app(DeliveryService::class)->startDelivery($delivery, $context['courier']);

        $this->actingAs($context['courier'])
            ->post(route('courier.deliveries.fail', $delivery), ['failed_reason' => 'Alamat Tidak Jelas'])
            ->assertRedirect(route('courier.deliveries.show', $delivery));

        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->firstOrFail();

        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'failed_delivery']);
        $this->assertDatabaseHas('deliveries', ['id' => $delivery->id, 'status' => 'failed', 'failed_reason' => 'Alamat Tidak Jelas']);
        $this->assertSame(10, $inventory->current_stock);
        $this->assertSame(1, $inventory->reserved_stock);
    }

    public function test_courier_cannot_update_another_courier_delivery(): void
    {
        $context = $this->makeReadyForPickupOrder(quantity: 1);
        $delivery = app(DeliveryService::class)->assignCourier($context['order'], $context['courier'], $context['owner']);
        $otherCourier = User::factory()->create(['role' => 'courier', 'is_active' => true, 'is_online' => true]);

        $this->actingAs($otherCourier)
            ->post(route('courier.deliveries.confirm-pickup', $delivery))
            ->assertForbidden();
    }

    public function test_order_must_be_ready_for_pickup_before_assigning_courier(): void
    {
        $context = $this->makeOrder(quantity: 1);

        $this->actingAs($context['owner'])
            ->post(route('owner.orders.assign-courier', $context['order']), ['courier_id' => $context['courier']->id])
            ->assertForbidden();

        $this->assertSame(0, Delivery::count());
    }

    private function makeReadyForPickupOrder(int $quantity): array
    {
        $context = $this->makeOrder($quantity);
        $orderStatusService = app(OrderStatusService::class);
        $orderStatusService->updateStatus($context['order'], 'confirmed', $context['outletUser']);
        $orderStatusService->updateStatus($context['order']->fresh(), 'preparing', $context['outletUser']);
        $context['order'] = $orderStatusService->updateStatus($context['order']->fresh(), 'ready_for_pickup', $context['outletUser']);

        return $context;
    }

    private function makeOrder(int $quantity): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true, 'is_online' => true]);
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890' . rand(1000, 9999)]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Banyumanik',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Banyumanik',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => uniqid('susu-kambing-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create(['name' => 'Susu Kambing', 'brand' => 'Dombi']);
        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Original 500ml',
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 1,
        ]);

        $address = CustomerAddress::create([
            'customer_id' => $customer->id,
            'recipient_name' => $customer->name,
            'phone' => '08123456789',
            'address' => 'Alamat customer',
            'latitude' => -7.0730000,
            'longitude' => 110.4215000,
        ]);

        $order = app(OrderService::class)->createCustomerOrder($customer, [
            'address_id' => $address->id,
            'items' => [['product_variant_id' => $variant->id, 'quantity' => $quantity]],
        ]);

        return compact('owner', 'outletUser', 'courier', 'customer', 'outlet', 'product', 'variant', 'order');
    }
}
