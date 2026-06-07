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

class MilestoneSixthTest extends TestCase
{
    use RefreshDatabase;

    // ─── INVENTORY SAFETY: TRANSACTION INTEGRITY ─────────────────────

    public function test_reserve_stock_is_atomic_within_transaction(): void
    {
        $context = $this->makeBaseContext();

        // Create order - this should reserve stock atomically
        $order = app(OrderService::class)->createCustomerOrder($context['customer'], [
            'address_id' => $context['address']->id,
            'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => 3]],
        ]);

        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();

        $this->assertSame(10, $inventory->current_stock);
        $this->assertSame(3, $inventory->reserved_stock);

        // Verify stock movement was recorded with correct before/after
        $movement = StockMovement::where('reference_id', $order->id)
            ->where('type', 'order_reserved')
            ->first();

        $this->assertNotNull($movement);
        $this->assertSame(10, $movement->before_stock);
        $this->assertSame(10, $movement->after_stock);
        $this->assertSame(0, $movement->before_reserved);
        $this->assertSame(3, $movement->after_reserved);
    }

    public function test_complete_order_stock_decrements_both_current_and_reserved(): void
    {
        $context = $this->makeCompletedDeliveryContext(quantity: 2);

        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();

        $this->assertSame(8, $inventory->current_stock);
        $this->assertSame(0, $inventory->reserved_stock);

        // Verify movement
        $movement = StockMovement::where('reference_id', $context['order']->id)
            ->where('type', 'order_completed')
            ->first();

        $this->assertNotNull($movement);
        $this->assertSame(10, $movement->before_stock);
        $this->assertSame(8, $movement->after_stock);
        $this->assertSame(2, $movement->before_reserved);
        $this->assertSame(0, $movement->after_reserved);
    }

    // ─── INVENTORY SAFETY: NO SILENT CORRECTION ──────────────────────

    public function test_no_silent_correction_on_insufficient_current_stock(): void
    {
        $context = $this->makeReadyForPickupOrder(quantity: 5);

        // Corrupt the stock state to simulate a bug
        OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->update(['current_stock' => 2]);

        $deliveryService = app(DeliveryService::class);
        $delivery = $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);
        $deliveryService->confirmPickup($delivery, $context['courier']);
        $deliveryService->startDelivery($delivery, $context['courier']);

        $this->expectException(InsufficientStockException::class);
        $deliveryService->completeDelivery($delivery, $context['courier']);
    }

    public function test_no_silent_correction_on_insufficient_reserved_stock(): void
    {
        $context = $this->makeReadyForPickupOrder(quantity: 3);

        // Corrupt reserved_stock
        OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->update(['reserved_stock' => 1]);

        $deliveryService = app(DeliveryService::class);
        $delivery = $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);
        $deliveryService->confirmPickup($delivery, $context['courier']);
        $deliveryService->startDelivery($delivery, $context['courier']);

        $this->expectException(InsufficientStockException::class);
        $deliveryService->completeDelivery($delivery, $context['courier']);
    }

    // ─── DELIVERY RESOLUTION FLOW ────────────────────────────────────

    public function test_failed_delivery_retry_removes_delivery_and_resets_order(): void
    {
        $context = $this->makeFailedDeliveryContext();

        app(DeliveryService::class)->resolveFailedDelivery(
            $context['delivery'],
            $context['owner'],
            'retry_delivery',
            'Coba kirim ulang'
        );

        // Order back to ready_for_pickup
        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'ready_for_pickup']);
        // Delivery deleted so new one can be assigned
        $this->assertSame(0, Delivery::where('order_id', $context['order']->id)->count());
        // Reserved stock unchanged
        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();
        $this->assertSame(2, $inventory->reserved_stock);
    }

    public function test_failed_delivery_returned_to_outlet_keeps_reserved_stock(): void
    {
        $context = $this->makeFailedDeliveryContext();

        app(DeliveryService::class)->resolveFailedDelivery(
            $context['delivery'],
            $context['owner'],
            'returned_to_outlet',
            'Barang dikembalikan'
        );

        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'preparing']);
        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();
        $this->assertSame(2, $inventory->reserved_stock);
    }

    public function test_failed_delivery_cancelled_releases_reserved_stock(): void
    {
        $context = $this->makeFailedDeliveryContext();

        app(DeliveryService::class)->resolveFailedDelivery(
            $context['delivery'],
            $context['owner'],
            'cancelled_and_released',
            'Customer tidak mau'
        );

        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'cancelled_by_outlet']);
        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();
        $this->assertSame(0, $inventory->reserved_stock);
    }

    public function test_resolution_records_actor_and_timestamp(): void
    {
        $context = $this->makeFailedDeliveryContext();

        app(DeliveryService::class)->resolveFailedDelivery(
            $context['delivery'],
            $context['owner'],
            'returned_to_outlet',
            'Barang dikembalikan'
        );

        $delivery = Delivery::find($context['delivery']->id);
        $this->assertSame($context['owner']->id, $delivery->resolved_by);
        $this->assertNotNull($delivery->resolved_at);
        $this->assertSame('returned_to_outlet', $delivery->resolution_status);
        $this->assertSame('Barang dikembalikan', $delivery->resolution_notes);
    }

    public function test_invalid_resolution_transition_is_rejected(): void
    {
        $context = $this->makeCompletedDeliveryContext(quantity: 1);

        $this->expectException(ValidationException::class);
        app(DeliveryService::class)->resolveFailedDelivery(
            $context['delivery'],
            $context['owner'],
            'retry_delivery'
        );
    }

    // ─── VALIDATION HARDENING ────────────────────────────────────────

    public function test_outlet_cannot_set_invalid_order_status(): void
    {
        $context = $this->makeOrderContext(quantity: 1);

        // Outlet tries to set status to 'completed' directly from pending
        $this->actingAs($context['outletUser'])
            ->post(route('outlet.orders.status', $context['order']), ['status' => 'completed'])
            ->assertSessionHasErrors('status');
    }

    public function test_outlet_cannot_set_status_to_delivering(): void
    {
        $context = $this->makeOrderContext(quantity: 1);

        // 'delivering' is not in outlet allowed statuses
        $this->actingAs($context['outletUser'])
            ->post(route('outlet.orders.status', $context['order']), ['status' => 'delivering'])
            ->assertSessionHasErrors('status');
    }

    public function test_outlet_can_confirm_pending_order(): void
    {
        $context = $this->makeOrderContext(quantity: 1);

        $this->actingAs($context['outletUser'])
            ->post(route('outlet.orders.status', $context['order']), ['status' => 'confirmed'])
            ->assertRedirect();

        $this->assertDatabaseHas('orders', ['id' => $context['order']->id, 'status' => 'confirmed']);
    }

    public function test_restock_approve_validates_item_belongs_to_request(): void
    {
        $context = $this->makeRestockContext();

        // Try to approve with a non-existent item ID
        $this->actingAs($context['owner'])
            ->post(route('owner.restocks.approve', $context['restock']), [
                'items' => [['restock_request_item_id' => 99999, 'approved_quantity' => 4]],
            ])
            ->assertSessionHasErrors();
    }

    public function test_restock_approve_with_all_zero_quantities_fails(): void
    {
        $context = $this->makeRestockContext();

        $this->actingAs($context['owner'])
            ->post(route('owner.restocks.approve', $context['restock']), [
                'items' => [['restock_request_item_id' => $context['restock']->items->first()->id, 'approved_quantity' => 0]],
            ])
            ->assertSessionHasErrors('items');
    }

    public function test_duplicate_delivery_assignment_is_prevented(): void
    {
        $context = $this->makeReadyForPickupOrder(quantity: 1);
        $deliveryService = app(DeliveryService::class);

        $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);

        $this->expectException(ValidationException::class);
        $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);
    }

    // ─── IDEMPOTENCY ─────────────────────────────────────────────────

    public function test_restock_confirm_received_idempotent(): void
    {
        $context = $this->makeShippedDistributionContext();

        $restockService = app(RestockService::class);
        $restockService->confirmReceived($context['distribution'], $context['outletUser']);
        $restockService->confirmReceived($context['distribution'], $context['outletUser']);

        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();

        // Stock should only increase once: 2 + 4 = 6
        $this->assertSame(6, $inventory->current_stock);
        $this->assertSame(1, StockMovement::where('reference_id', $context['distribution']->id)->where('type', 'restock_in')->count());
    }

    // ─── ORDER CODE SAFETY ───────────────────────────────────────────

    public function test_order_code_generation_handles_duplicates(): void
    {
        $context = $this->makeBaseContext();

        $order1 = app(OrderService::class)->createCustomerOrder($context['customer'], [
            'address_id' => $context['address']->id,
            'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => 1]],
        ]);

        $order2 = app(OrderService::class)->createCustomerOrder($context['customer'], [
            'address_id' => $context['address']->id,
            'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => 1]],
        ]);

        $this->assertNotEquals($order1->order_code, $order2->order_code);
        $this->assertStringStartsWith('DOMBI-', $order1->order_code);
        $this->assertStringStartsWith('DOMBI-', $order2->order_code);
    }

    // ─── AUDIT TRAIL ─────────────────────────────────────────────────

    public function test_stock_movement_audit_trail_page_accessible(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->actingAs($owner)
            ->get(route('owner.stock-movements.index'))
            ->assertOk();
    }

    public function test_stock_movement_filters_work(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $context = $this->makeOrderContext(quantity: 1);

        $this->actingAs($owner)
            ->get(route('owner.stock-movements.index', ['outlet_id' => $context['outlet']->id]))
            ->assertOk();

        $this->actingAs($owner)
            ->get(route('owner.stock-movements.index', ['type' => 'order_reserved']))
            ->assertOk();
    }

    // ─── ADJUST STOCK SAFETY ─────────────────────────────────────────

    public function test_adjust_stock_cannot_go_below_reserved(): void
    {
        $context = $this->makeOrderContext(quantity: 5);

        // reserved_stock is now 5, trying to set current_stock to 3
        $this->expectException(InsufficientStockException::class);
        app(InventoryService::class)->adjustStock(
            $context['outlet']->id,
            $context['variant']->id,
            3
        );
    }

    public function test_adjust_stock_records_movement_with_actor(): void
    {
        $context = $this->makeBaseContext();
        $owner = $context['owner'];

        $this->actingAs($owner);
        app(InventoryService::class)->adjustStock(
            $context['outlet']->id,
            $context['variant']->id,
            15,
            'Stok fisik dihitung ulang'
        );

        $movement = StockMovement::where('outlet_id', $context['outlet']->id)
            ->where('type', 'stock_adjustment')
            ->latest()
            ->first();

        $this->assertNotNull($movement);
        $this->assertSame(10, $movement->before_stock);
        $this->assertSame(15, $movement->after_stock);
        $this->assertSame(5, $movement->quantity);
        $this->assertSame($owner->id, $movement->created_by);
        $this->assertSame('Stok fisik dihitung ulang', $movement->notes);
    }

    // ─── HELPERS ─────────────────────────────────────────────────────

    private function makeBaseContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true, 'is_online' => true]);
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890' . rand(1000, 9999)]);

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
            'center_stock' => 100,
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

        return compact('owner', 'outletUser', 'courier', 'customer', 'outlet', 'product', 'variant', 'address');
    }

    private function makeOrderContext(int $quantity): array
    {
        $context = $this->makeBaseContext();

        $order = app(OrderService::class)->createCustomerOrder($context['customer'], [
            'address_id' => $context['address']->id,
            'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => $quantity]],
        ]);

        return [...$context, 'order' => $order];
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

    private function makeFailedDeliveryContext(): array
    {
        $context = $this->makeReadyForPickupOrder(quantity: 2);
        $deliveryService = app(DeliveryService::class);
        $delivery = $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);
        $deliveryService->confirmPickup($delivery, $context['courier']);
        $deliveryService->startDelivery($delivery, $context['courier']);
        $delivery = $deliveryService->failDelivery($delivery, $context['courier'], 'Alamat tidak ditemukan');

        return [...$context, 'delivery' => $delivery->fresh()];
    }

    private function makeCompletedDeliveryContext(int $quantity): array
    {
        $context = $this->makeReadyForPickupOrder(quantity: $quantity);
        $deliveryService = app(DeliveryService::class);
        $delivery = $deliveryService->assignCourier($context['order'], $context['courier'], $context['owner']);
        $deliveryService->confirmPickup($delivery, $context['courier']);
        $deliveryService->startDelivery($delivery, $context['courier']);
        $delivery = $deliveryService->completeDelivery($delivery, $context['courier']);

        return [...$context, 'delivery' => $delivery->fresh()];
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

        $restock = app(RestockService::class)->createRequest($outletUser, [
            'notes' => 'Perlu restock',
            'items' => [['product_variant_id' => $variant->id, 'requested_quantity' => 6]],
        ])->load('items');

        return compact('owner', 'outletUser', 'outlet', 'product', 'variant', 'restock');
    }

    private function makeShippedDistributionContext(): array
    {
        $context = $this->makeRestockContext();
        $restockService = app(RestockService::class);

        $restockService->approveRequest($context['restock'], $context['owner'], [
            ['restock_request_item_id' => $context['restock']->items->first()->id, 'approved_quantity' => 4],
        ]);

        $distribution = $context['restock']->fresh('distribution')->distribution;
        $restockService->markShipped($distribution, $context['owner']);

        return [...$context, 'distribution' => $distribution->fresh()];
    }
}
