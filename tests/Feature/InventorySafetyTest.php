<?php

namespace Tests\Feature;

use App\Exceptions\InsufficientStockException;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\DeliveryService;
use App\Services\InventoryService;
use App\Services\OrderService;
use App\Services\OrderStatusService;
use App\Services\RestockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class InventorySafetyTest extends TestCase
{
    use RefreshDatabase;

    // ─── STRICT STOCK VALIDATION ─────────────────────────────────────

    public function test_complete_order_stock_throws_when_current_stock_insufficient(): void
    {
        $context = $this->makeOrderContext(quantity: 5);
        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();

        // Artificially reduce current_stock below what's needed
        $inventory->update(['current_stock' => 2]);

        $this->expectException(InsufficientStockException::class);
        app(InventoryService::class)->completeOrderStock($context['order']);
    }

    public function test_complete_order_stock_throws_when_reserved_stock_insufficient(): void
    {
        $context = $this->makeOrderContext(quantity: 3);
        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();

        // Artificially reduce reserved_stock below what's needed
        $inventory->update(['reserved_stock' => 1]);

        $this->expectException(InsufficientStockException::class);
        app(InventoryService::class)->completeOrderStock($context['order']);
    }

    public function test_release_reserved_stock_gracefully_handles_insufficient_reserved(): void
    {
        $context = $this->makeOrderContext(quantity: 3);
        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();

        // Artificially reduce reserved_stock below what's needed
        $inventory->update(['reserved_stock' => 1]);

        // Should not throw - graceful degradation sets reserved to 0
        app(InventoryService::class)->releaseReservedStock($context['order']);

        $inventory->refresh();
        $this->assertSame(0, $inventory->reserved_stock);
    }

    public function test_adjust_stock_throws_when_new_stock_below_reserved(): void
    {
        $context = $this->makeOrderContext(quantity: 3);

        $this->expectException(InsufficientStockException::class);
        // reserved_stock is 3, trying to set current_stock to 2
        app(InventoryService::class)->adjustStock(
            $context['outlet']->id,
            $context['variant']->id,
            2
        );
    }

    // ─── STOCK MOVEMENT AUDIT TRAIL ──────────────────────────────────

    public function test_stock_movements_record_before_after_reserved(): void
    {
        $context = $this->makeOrderContext(quantity: 2);

        $movement = StockMovement::where('reference_id', $context['order']->id)
            ->where('type', 'order_reserved')
            ->first();

        $this->assertNotNull($movement);
        $this->assertSame(0, $movement->before_reserved);
        $this->assertSame(2, $movement->after_reserved);
    }

    // ─── IDEMPOTENCY ─────────────────────────────────────────────────

    public function test_restock_confirm_received_is_idempotent(): void
    {
        $context = $this->makeRestockContext();
        $distribution = $context['distribution'];
        $outletUser = $context['outletUser'];

        // First confirm
        $this->actingAs($outletUser)
            ->post(route('outlet.distributions.confirm-received', $distribution))
            ->assertRedirect();

        // Second confirm - should not double-add stock
        $this->actingAs($outletUser)
            ->post(route('outlet.distributions.confirm-received', $distribution))
            ->assertRedirect();

        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();

        // Only added once: initial 2 + restock 4 = 6
        $this->assertSame(6, $inventory->current_stock);
        $this->assertSame(1, StockMovement::where('reference_id', $distribution->id)->where('type', 'restock_in')->count());
    }

    // ─── DELIVERY UNIQUENESS ─────────────────────────────────────────

    public function test_cannot_create_duplicate_delivery_for_same_order(): void
    {
        $context = $this->makeReadyForPickupOrder(quantity: 1);
        $deliveryService = app(DeliveryService::class);

        $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);

        $this->expectException(ValidationException::class);
        $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);
    }

    // ─── ORDER CODE RETRY ────────────────────────────────────────────

    public function test_order_code_is_unique_across_concurrent_orders(): void
    {
        $context = $this->makeOrderContext(quantity: 1);
        $order1 = $context['order'];

        // Create another order - should get different code
        $customer = $context['customer'];
        $address = CustomerAddress::where('customer_id', $customer->id)->first();

        $order2 = app(OrderService::class)->createCustomerOrder($customer, [
            'address_id' => $address->id,
            'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => 1]],
        ]);

        $this->assertNotEquals($order1->order_code, $order2->order_code);
    }

    // ─── FAILED DELIVERY RESOLUTION ──────────────────────────────────

    public function test_failed_delivery_can_be_resolved_with_retry(): void
    {
        $context = $this->makeFailedDelivery();

        $this->actingAs($context['owner'])
            ->post(route('owner.deliveries.resolve', $context['delivery']), [
                'resolution' => 'retry_delivery',
                'resolution_notes' => 'Coba kirim ulang besok',
            ])
            ->assertRedirect();

        // Order should be back to ready_for_pickup
        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'ready_for_pickup']);
        // Old delivery should be deleted (so new one can be assigned)
        $this->assertSame(0, Delivery::where('order_id', $context['order']->id)->count());
    }

    public function test_failed_delivery_can_be_resolved_with_returned_to_outlet(): void
    {
        $context = $this->makeFailedDelivery();

        $this->actingAs($context['owner'])
            ->post(route('owner.deliveries.resolve', $context['delivery']), [
                'resolution' => 'returned_to_outlet',
                'resolution_notes' => 'Barang dikembalikan',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'preparing']);
        // Reserved stock should still be held
        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();
        $this->assertSame(1, $inventory->reserved_stock);
    }

    public function test_failed_delivery_can_be_cancelled_and_stock_released(): void
    {
        $context = $this->makeFailedDelivery();

        $this->actingAs($context['owner'])
            ->post(route('owner.deliveries.resolve', $context['delivery']), [
                'resolution' => 'cancelled_and_released',
                'resolution_notes' => 'Customer tidak mau',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'cancelled_by_outlet']);
        // Reserved stock should be released
        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();
        $this->assertSame(0, $inventory->reserved_stock);
    }

    public function test_completed_delivery_cannot_be_resolved(): void
    {
        $context = $this->makeReadyForPickupOrder(quantity: 1);
        $deliveryService = app(DeliveryService::class);
        $delivery = $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);
        $deliveryService->confirmPickup($delivery, $context['courier']);
        $deliveryService->startDelivery($delivery, $context['courier']);
        $deliveryService->completeDelivery($delivery, $context['courier']);

        $this->actingAs($context['owner'])
            ->post(route('owner.deliveries.resolve', $delivery), [
                'resolution' => 'retry_delivery',
                'resolution_notes' => 'Trying to resolve completed delivery',
            ])
            ->assertSessionHasErrors('resolution');
    }

    // ─── TRANSITION VALIDATION ───────────────────────────────────────

    public function test_order_cannot_skip_status_transitions(): void
    {
        $context = $this->makeOrderContext(quantity: 1);
        $orderStatusService = app(OrderStatusService::class);

        // Cannot go from pending directly to ready_for_pickup
        $this->expectException(ValidationException::class);
        $orderStatusService->updateStatus($context['order'], 'ready_for_pickup', $context['outletUser']);
    }

    public function test_delivery_cannot_skip_status_transitions(): void
    {
        $context = $this->makeReadyForPickupOrder(quantity: 1);
        $deliveryService = app(DeliveryService::class);
        $delivery = $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);

        // Cannot go from waiting_pickup directly to delivering
        $this->expectException(ValidationException::class);
        $deliveryService->startDelivery($delivery, $context['courier']);
    }

    // ─── RESTOCK VALIDATION ──────────────────────────────────────────

    public function test_approve_restock_with_invalid_item_id_fails(): void
    {
        $context = $this->makeRestockRequestContext();

        $this->actingAs($context['owner'])
            ->post(route('owner.restocks.approve', $context['restock']), [
                'items' => [['restock_request_item_id' => 99999, 'approved_quantity' => 4]],
            ])
            ->assertSessionHasErrors();
    }

    // ─── ROLLBACK VALIDATION ─────────────────────────────────────────

    public function test_failed_stock_operation_rolls_back_entire_transaction(): void
    {
        $context = $this->makeOrderContext(quantity: 2);
        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();

        $originalStock = $inventory->current_stock;
        $originalReserved = $inventory->reserved_stock;

        // Artificially break the stock state
        $inventory->update(['reserved_stock' => 0]);

        try {
            app(InventoryService::class)->completeOrderStock($context['order']);
        } catch (InsufficientStockException) {
            // Expected
        }

        // Stock should not have changed
        $inventory->refresh();
        $this->assertSame($originalStock, $inventory->current_stock);
    }

    // ─── HELPERS ─────────────────────────────────────────────────────

    private function makeFailedDelivery(): array
    {
        $context = $this->makeReadyForPickupOrder(quantity: 1);
        $deliveryService = app(DeliveryService::class);
        $delivery = $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);
        $deliveryService->confirmPickup($delivery, $context['courier']);
        $deliveryService->startDelivery($delivery, $context['courier']);
        $delivery = $deliveryService->failDelivery($delivery, $context['courier'], 'Alamat tidak ditemukan');

        return [...$context, 'delivery' => $delivery->fresh()];
    }

    private function makeReadyForPickupOrder(int $quantity): array
    {
        $context = $this->makeOrderContext($quantity);
        $orderStatusService = app(OrderStatusService::class);
        $orderStatusService->updateStatus($context['order'], 'confirmed', $context['outletUser']);
        $orderStatusService->updateStatus($context['order']->fresh(), 'preparing', $context['outletUser']);
        $context['order'] = $orderStatusService->updateStatus($context['order']->fresh(), 'ready_for_pickup', $context['outletUser']);

        return $context;
    }

    private function makeOrderContext(int $quantity): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true, 'is_online' => true]);
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890'.rand(1000, 9999)]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Test',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Test',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ]);
        $outletUser->update(['outlet_id' => $outlet->id]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => uniqid('susu-kambing-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create([
            'name' => 'Susu Kambing',
            'brand' => 'Test',
            'is_active' => true,
        ]);

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

    private function makeRestockContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Restock',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Restock',
            'status' => 'active',
        ]);
        $outletUser->update(['outlet_id' => $outlet->id]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => uniqid('susu-kambing-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create([
            'name' => 'Susu Kambing Restock',
            'brand' => 'Test',
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Original 500ml',
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'center_stock' => 100,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 2,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        $restockService = app(RestockService::class);
        $restock = $restockService->createRequest($outletUser, [
            'notes' => 'Perlu restock',
            'items' => [['product_variant_id' => $variant->id, 'requested_quantity' => 6]],
        ])->load('items');

        $restockService->approveRequest($restock, $owner, [
            ['restock_request_item_id' => $restock->items->first()->id, 'approved_quantity' => 4],
        ]);

        $distribution = $restock->fresh('distribution')->distribution;
        $restockService->markShipped($distribution, $owner);

        return compact('owner', 'outletUser', 'outlet', 'product', 'variant', 'distribution');
    }

    private function makeRestockRequestContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Restock',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Restock',
            'status' => 'active',
        ]);
        $outletUser->update(['outlet_id' => $outlet->id]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => uniqid('susu-kambing-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create([
            'name' => 'Susu Kambing Request',
            'brand' => 'Test',
            'is_active' => true,
        ]);

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
            'current_stock' => 2,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        $restock = app(RestockService::class)->createRequest($outletUser, [
            'notes' => 'Perlu restock',
            'items' => [['product_variant_id' => $variant->id, 'requested_quantity' => 6]],
        ])->load('items');

        return compact('owner', 'outletUser', 'outlet', 'product', 'variant', 'restock');
    }
}
