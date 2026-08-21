<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\OfflineSale;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Settlement;
use App\Models\User;
use App\Services\SettlementGeneratorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NetSettlementTest extends TestCase
{
    use RefreshDatabase;

    private SettlementGeneratorService $service;

    private Outlet $outlet;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(SettlementGeneratorService::class);
        $this->outlet = Outlet::factory()->create(['status' => 'active']);
        $this->product = Product::factory()->create([
            'center_price' => 10000,
            'selling_price' => 15000,
        ]);
    }

    private function createCompletedOrder(float $sellingPrice, float $centerPrice, int $qty, float $deliveryFee = 0): Order
    {
        $order = Order::create([
            'order_code' => 'TEST-'.time().rand(1000, 9999),
            'customer_name' => 'Test Customer',
            'customer_phone' => '08123456789',
            'customer_address' => 'Test Address',
            'customer_id' => null,
            'outlet_id' => $this->outlet->id,
            'status' => 'completed',
            'fulfillment_type' => 'delivery',
            'payment_method' => 'qris',
            'payment_status' => 'paid',
            'subtotal' => $sellingPrice * $qty,
            'delivery_fee' => $deliveryFee,
            'total' => ($sellingPrice * $qty) + $deliveryFee,
            'completed_at' => now(),
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'quantity' => $qty,
            'price' => $sellingPrice,
            'unit_price' => $sellingPrice,
            'subtotal' => $sellingPrice * $qty,
            'center_price_snapshot' => $centerPrice,
            'selling_price_snapshot' => $sellingPrice,
            'outlet_margin_snapshot' => $sellingPrice - $centerPrice,
        ]);

        return $order;
    }

    private function createDelivery(Order $order, string $status, float $courierCost, string $courierType = 'eksternal'): void
    {
        Delivery::create([
            'order_id' => $order->id,
            'courier_type' => $courierType,
            'status' => $status,
            'courier_cost' => $courierCost,
            'assigned_at' => now(),
        ]);
    }

    private function createOfflineSale(int $qty, float $centerPrice): void
    {
        $user = User::factory()->create(['role' => 'outlet']);

        OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => $qty,
            'center_price' => $centerPrice,
            'total_amount' => $centerPrice * $qty,
            'created_by' => $user->id,
        ]);
    }

    public function test_positive_net_owner_pays_outlet(): void
    {
        // Online order: selling=15000, center=10000, qty=1, outlet_share=5000
        $this->createCompletedOrder(15000, 10000, 1);

        $settlement = $this->service->generateForOutlet($this->outlet, now());

        $this->assertNotNull($settlement);
        $this->assertEqualsWithDelta(5000.0, (float) $settlement->total_online_share, 0.01);
        $this->assertEqualsWithDelta(0.0, (float) $settlement->total_delivery_cost, 0.01);
        $this->assertEqualsWithDelta(0.0, (float) $settlement->total_refund, 0.01);
        $this->assertEqualsWithDelta(0.0, (float) $settlement->total_offline_sales, 0.01);
        $this->assertEqualsWithDelta(5000.0, (float) $settlement->net_amount, 0.01);
        $this->assertEquals(Settlement::DIRECTION_OWNER_PAYS, $settlement->direction);
        $this->assertEqualsWithDelta(5000.0, (float) $settlement->amount_due, 0.01);
    }

    public function test_negative_net_outlet_pays_owner(): void
    {
        // Offline sale only: center_price=10000, qty=1 → outlet owes 10000
        $this->createOfflineSale(1, 10000);

        $settlement = $this->service->generateForOutlet($this->outlet, now());

        $this->assertNotNull($settlement);
        $this->assertEqualsWithDelta(0.0, (float) $settlement->total_online_share, 0.01);
        $this->assertEqualsWithDelta(10000.0, (float) $settlement->total_offline_sales, 0.01);
        $this->assertEqualsWithDelta(-10000.0, (float) $settlement->net_amount, 0.01);
        $this->assertEquals(Settlement::DIRECTION_OUTLET_PAYS, $settlement->direction);
        $this->assertEqualsWithDelta(10000.0, (float) $settlement->amount_due, 0.01);
    }

    public function test_delivery_cost_deducted_from_outlet_share(): void
    {
        // Online order: outlet_share=5000, delivery_cost=3000 → net=2000
        $order = $this->createCompletedOrder(15000, 10000, 1, 5000);
        $this->createDelivery($order, 'delivered', 3000);

        $settlement = $this->service->generateForOutlet($this->outlet, now());

        $this->assertNotNull($settlement);
        $this->assertEqualsWithDelta(5000.0, (float) $settlement->total_online_share, 0.01);
        $this->assertEqualsWithDelta(3000.0, (float) $settlement->total_delivery_cost, 0.01);
        $this->assertEqualsWithDelta(2000.0, (float) $settlement->net_amount, 0.01);
        $this->assertEquals(Settlement::DIRECTION_OWNER_PAYS, $settlement->direction);
    }

    public function test_refund_deducted_from_outlet_share(): void
    {
        // Online order: outlet_share=5000, refund=15000 → net=-10000
        $order = $this->createCompletedOrder(15000, 10000, 1);
        $order->update([
            'payment_status' => 'refunded',
            'refund_amount' => 15000,
            'refund_requested_at' => now(),
        ]);

        $settlement = $this->service->generateForOutlet($this->outlet, now());

        $this->assertNotNull($settlement);
        $this->assertEqualsWithDelta(5000.0, (float) $settlement->total_online_share, 0.01);
        $this->assertEqualsWithDelta(15000.0, (float) $settlement->total_refund, 0.01);
        $this->assertEqualsWithDelta(-10000.0, (float) $settlement->net_amount, 0.01);
        $this->assertEquals(Settlement::DIRECTION_OUTLET_PAYS, $settlement->direction);
    }

    public function test_zero_net_marks_as_paid(): void
    {
        // Online share=5000, offline_sales=5000 → net=0
        $this->createCompletedOrder(15000, 10000, 1);
        $this->createOfflineSale(1, 5000);

        $settlement = $this->service->generateForOutlet($this->outlet, now());

        $this->assertNotNull($settlement);
        $this->assertEqualsWithDelta(0.0, (float) $settlement->net_amount, 0.01);
        $this->assertEquals(Settlement::STATUS_PAID, $settlement->status);
    }

    public function test_mixed_scenario(): void
    {
        // Online: 2 orders with outlet_share=5000 each = 10000
        $order1 = $this->createCompletedOrder(15000, 10000, 1, 5000);
        $this->createDelivery($order1, 'delivered', 2000);

        $order2 = $this->createCompletedOrder(15000, 10000, 1, 3000);
        $this->createDelivery($order2, 'delivered', 1000);

        // Refund on order1: 15000
        $order1->update([
            'payment_status' => 'refunded',
            'refund_amount' => 15000,
            'refund_requested_at' => now(),
        ]);

        // Offline sales: 2000
        $this->createOfflineSale(1, 2000);

        // Expected:
        // online_outlet_share = 5000 + 5000 = 10000
        // delivery_cost = 2000 + 1000 = 3000
        // refund = 15000
        // offline_sales = 2000
        // net = (10000 - 3000 - 15000) - 2000 = -10000
        $settlement = $this->service->generateForOutlet($this->outlet, now());

        $this->assertNotNull($settlement);
        $this->assertEqualsWithDelta(10000.0, (float) $settlement->total_online_share, 0.01);
        $this->assertEqualsWithDelta(3000.0, (float) $settlement->total_delivery_cost, 0.01);
        $this->assertEqualsWithDelta(15000.0, (float) $settlement->total_refund, 0.01);
        $this->assertEqualsWithDelta(2000.0, (float) $settlement->total_offline_sales, 0.01);
        $this->assertEqualsWithDelta(-10000.0, (float) $settlement->net_amount, 0.01);
        $this->assertEquals(Settlement::DIRECTION_OUTLET_PAYS, $settlement->direction);
        $this->assertEqualsWithDelta(10000.0, (float) $settlement->amount_due, 0.01);
    }
}
