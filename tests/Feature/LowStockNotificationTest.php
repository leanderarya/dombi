<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Notification;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\InventoryService;
use App\Services\NotificationService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LowStockNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_complete_order_stock_sends_low_stock_notification_when_below_minimum(): void
    {
        $context = $this->makeOrderContext(quantity: 8, currentStock: 10, minimumStock: 5);

        app(InventoryService::class)->completeOrderStock($context['order']);

        $this->assertDatabaseHas('notifications', [
            'type' => NotificationService::LOW_STOCK,
            'entity_type' => 'outlet',
            'entity_id' => $context['outlet']->id,
        ]);
    }

    public function test_complete_order_stock_sends_critical_stock_notification_when_zero(): void
    {
        $context = $this->makeOrderContext(quantity: 10, currentStock: 10, minimumStock: 5);

        app(InventoryService::class)->completeOrderStock($context['order']);

        $this->assertDatabaseHas('notifications', [
            'type' => NotificationService::CRITICAL_STOCK,
            'entity_type' => 'outlet',
            'entity_id' => $context['outlet']->id,
        ]);
    }

    public function test_complete_order_stock_does_not_notify_when_stock_above_minimum(): void
    {
        $context = $this->makeOrderContext(quantity: 2, currentStock: 10, minimumStock: 1);

        app(InventoryService::class)->completeOrderStock($context['order']);

        $this->assertDatabaseMissing('notifications', [
            'type' => NotificationService::LOW_STOCK,
            'entity_type' => 'outlet',
            'entity_id' => $context['outlet']->id,
        ]);
    }

    public function test_low_stock_notification_is_not_duplicated_within_24_hours(): void
    {
        $context = $this->makeOrderContext(quantity: 8, currentStock: 10, minimumStock: 5);

        // First order triggers notification
        app(InventoryService::class)->completeOrderStock($context['order']);

        $countBefore = Notification::where('type', NotificationService::LOW_STOCK)
            ->where('entity_type', 'outlet')
            ->where('entity_id', $context['outlet']->id)
            ->count();

        // Create another order that also brings stock below minimum
        $customer = $context['customer'];
        $address = CustomerAddress::where('customer_id', $customer->id)->first();
        $order2 = app(OrderService::class)->createCustomerOrder($customer, [
            'address_id' => $address->id,
            'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => 1]],
        ]);

        // Set stock low enough for second order
        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_variant_id', $context['variant']->id)
            ->first();
        $inventory->update(['current_stock' => 2, 'reserved_stock' => 1]);

        app(InventoryService::class)->completeOrderStock($order2);

        $countAfter = Notification::where('type', NotificationService::LOW_STOCK)
            ->where('entity_type', 'outlet')
            ->where('entity_id', $context['outlet']->id)
            ->count();

        // Should not create duplicate notification
        $this->assertSame($countBefore, $countAfter);
    }

    public function test_low_stock_notification_includes_correct_data(): void
    {
        $context = $this->makeOrderContext(quantity: 8, currentStock: 10, minimumStock: 5);

        app(InventoryService::class)->completeOrderStock($context['order']);

        $notification = Notification::where('type', NotificationService::LOW_STOCK)
            ->where('entity_type', 'outlet')
            ->where('entity_id', $context['outlet']->id)
            ->first();

        $this->assertNotNull($notification);
        $this->assertStringContainsString($context['variant']->full_name, $notification->message);
        $this->assertStringContainsString('2', $notification->message); // available stock
        $this->assertStringContainsString('5', $notification->message); // minimum stock
    }

    private function makeOrderContext(int $quantity, int $currentStock = 10, int $minimumStock = 1): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
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
            'current_stock' => $currentStock,
            'reserved_stock' => 0,
            'minimum_stock' => $minimumStock,
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

        return compact('owner', 'outletUser', 'customer', 'outlet', 'product', 'variant', 'order');
    }
}
