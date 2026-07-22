<?php

namespace Tests\Feature\Services;

use App\Exceptions\StockAdjustedException;
use App\Models\Customer;
use App\Models\OutletOperatingHours;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_order_throws_exception_when_stock_insufficient(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        foreach (range(0, 6) as $day) {
            OutletOperatingHours::create([
                'outlet_id' => $outlet->id,
                'day_of_week' => $day,
                'open_time' => '00:00',
                'close_time' => '23:59',
                'is_closed' => false,
            ]);
        }
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 8,
            'minimum_stock' => 2,
        ]);

        $orderService = app(OrderService::class);

        $this->expectException(StockAdjustedException::class);

        try {
            $orderService->createCheckoutOrder($user, [
                'items' => [
                    ['product_variant_id' => $variant->id, 'quantity' => 5],
                ],
                'fulfillment_type' => 'pickup',
                'selected_outlet_id' => $outlet->id,
                'customer_name' => 'Test Customer',
                'phone_number' => '6281234567890',
                'payment_method' => 'qris',
            ]);
        } catch (StockAdjustedException $e) {
            $this->assertCount(1, $e->adjustments);
            $this->assertEquals($variant->id, $e->adjustments[0]['variant_id']);
            $this->assertEquals(5, $e->adjustments[0]['original_qty']);
            $this->assertEquals(2, $e->adjustments[0]['adjusted_qty']);
            $this->assertEquals(2, $e->adjustments[0]['available_stock']);
            throw $e;
        }
    }

    public function test_create_order_succeeds_when_stock_sufficient(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        foreach (range(0, 6) as $day) {
            OutletOperatingHours::create([
                'outlet_id' => $outlet->id,
                'day_of_week' => $day,
                'open_time' => '00:00',
                'close_time' => '23:59',
                'is_closed' => false,
            ]);
        }
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 3,
            'minimum_stock' => 2,
        ]);

        $orderService = app(OrderService::class);

        $order = $orderService->createCheckoutOrder($user, [
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 5],
            ],
            'fulfillment_type' => 'pickup',
            'selected_outlet_id' => $outlet->id,
            'customer_name' => 'Test Customer',
            'phone_number' => '6281234567890',
            'payment_method' => 'qris',
        ]);

        $this->assertInstanceOf(Order::class, $order);
        $this->assertEquals($outlet->id, $order->outlet_id);
    }

    public function test_create_order_throws_exception_when_stock_zero(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        foreach (range(0, 6) as $day) {
            OutletOperatingHours::create([
                'outlet_id' => $outlet->id,
                'day_of_week' => $day,
                'open_time' => '00:00',
                'close_time' => '23:59',
                'is_closed' => false,
            ]);
        }
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 10,
            'minimum_stock' => 2,
        ]);

        $orderService = app(OrderService::class);

        $this->expectException(StockAdjustedException::class);

        try {
            $orderService->createCheckoutOrder($user, [
                'items' => [
                    ['product_variant_id' => $variant->id, 'quantity' => 5],
                ],
                'fulfillment_type' => 'pickup',
                'selected_outlet_id' => $outlet->id,
                'customer_name' => 'Test Customer',
                'phone_number' => '6281234567890',
                'payment_method' => 'qris',
            ]);
        } catch (StockAdjustedException $e) {
            $this->assertCount(1, $e->adjustments);
            $this->assertEquals($variant->id, $e->adjustments[0]['variant_id']);
            $this->assertEquals(5, $e->adjustments[0]['original_qty']);
            $this->assertEquals(0, $e->adjustments[0]['adjusted_qty']);
            $this->assertEquals(0, $e->adjustments[0]['available_stock']);
            throw $e;
        }
    }
}
