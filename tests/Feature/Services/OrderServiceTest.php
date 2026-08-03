<?php

namespace Tests\Feature\Services;

use App\Exceptions\StockAdjustedException;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletOperatingHours;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
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
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 8,
            'minimum_stock' => 2,
        ]);

        $orderService = app(OrderService::class);

        $this->expectException(StockAdjustedException::class);

        try {
            $orderService->createCheckoutOrder($user, [
                'items' => [
                    ['product_id' => $variant->id, 'quantity' => 5],
                ],
                'fulfillment_type' => 'pickup',
                'selected_outlet_id' => $outlet->id,
                'customer_name' => 'Test Customer',
                'phone_number' => '6281234567890',
                'payment_method' => 'qris',
            ]);
        } catch (StockAdjustedException $e) {
            $this->assertCount(1, $e->adjustments);
            $this->assertEquals($variant->id, $e->adjustments[0]['product_id']);
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
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 3,
            'minimum_stock' => 2,
        ]);

        $orderService = app(OrderService::class);

        $order = $orderService->createCheckoutOrder($user, [
            'items' => [
                ['product_id' => $variant->id, 'quantity' => 5],
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
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 10,
            'minimum_stock' => 2,
        ]);

        $orderService = app(OrderService::class);

        $this->expectException(StockAdjustedException::class);

        try {
            $orderService->createCheckoutOrder($user, [
                'items' => [
                    ['product_id' => $variant->id, 'quantity' => 5],
                ],
                'fulfillment_type' => 'pickup',
                'selected_outlet_id' => $outlet->id,
                'customer_name' => 'Test Customer',
                'phone_number' => '6281234567890',
                'payment_method' => 'qris',
            ]);
        } catch (StockAdjustedException $e) {
            $this->assertCount(1, $e->adjustments);
            $this->assertEquals($variant->id, $e->adjustments[0]['product_id']);
            $this->assertEquals(5, $e->adjustments[0]['original_qty']);
            $this->assertEquals(0, $e->adjustments[0]['adjusted_qty']);
            $this->assertEquals(0, $e->adjustments[0]['available_stock']);
            throw $e;
        }
    }

    public function test_delivery_order_uses_selected_outlet_even_when_another_is_nearer(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $variant = Product::factory()->create();

        $near = Outlet::factory()->create([
            'status' => 'active',
            'latitude' => -7.0500,
            'longitude' => 110.4300,
            'delivery_radius_km' => 20,
        ]);
        $selected = Outlet::factory()->create([
            'status' => 'active',
            'latitude' => -7.0300,
            'longitude' => 110.4500,
            'delivery_radius_km' => 20,
        ]);
        foreach ([$near, $selected] as $o) {
            foreach (range(0, 6) as $day) {
                OutletOperatingHours::create([
                    'outlet_id' => $o->id,
                    'day_of_week' => $day,
                    'open_time' => '00:00',
                    'close_time' => '23:59',
                    'is_closed' => false,
                ]);
            }
            OutletInventory::factory()->create([
                'outlet_id' => $o->id,
                'product_id' => $variant->id,
                'current_stock' => 10,
                'reserved_stock' => 0,
                'minimum_stock' => 0,
            ]);
        }

        $orderService = app(OrderService::class);

        $order = $orderService->createCheckoutOrder($user, [
            'items' => [['product_id' => $variant->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery_dombi',
            'selected_outlet_id' => $selected->id,
            'customer_name' => 'Test Customer',
            'phone_number' => '6281234567890',
            'payment_method' => 'qris',
            'address_line' => 'Jl. Test',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
        ]);

        $this->assertSame($selected->id, $order->outlet_id);
        $this->assertSame($selected->id, $order->recommended_outlet_id);
    }

    public function test_delivery_order_aborts_when_selected_outlet_lacks_stock_even_if_other_outlet_has_stock(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $variant = Product::factory()->create();

        $selected = Outlet::factory()->create([
            'status' => 'active',
            'latitude' => -7.0300,
            'longitude' => 110.4500,
            'delivery_radius_km' => 20,
        ]);
        $other = Outlet::factory()->create([
            'status' => 'active',
            'latitude' => -7.0500,
            'longitude' => 110.4300,
            'delivery_radius_km' => 20,
        ]);
        foreach ([$selected, $other] as $o) {
            foreach (range(0, 6) as $day) {
                OutletOperatingHours::create([
                    'outlet_id' => $o->id,
                    'day_of_week' => $day,
                    'open_time' => '00:00',
                    'close_time' => '23:59',
                    'is_closed' => false,
                ]);
            }
        }
        // Only the OTHER outlet has stock.
        OutletInventory::factory()->create([
            'outlet_id' => $other->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 0,
        ]);

        $orderService = app(OrderService::class);

        $this->expectException(ValidationException::class);

        $orderService->createCheckoutOrder($user, [
            'items' => [['product_id' => $variant->id, 'quantity' => 1]],
            'fulfillment_type' => 'delivery_dombi',
            'selected_outlet_id' => $selected->id,
            'customer_name' => 'Test Customer',
            'phone_number' => '6281234567890',
            'payment_method' => 'qris',
            'address_line' => 'Jl. Test',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
        ]);

        $this->assertSame(0, Order::count(), 'No order may be created when selected outlet is ineligible.');
    }
}
