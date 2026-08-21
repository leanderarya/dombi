<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Services\CourierRevenueService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierRevenueServiceTest extends TestCase
{
    use RefreshDatabase;

    private Outlet $outletA;

    private Outlet $outletB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->outletA = Outlet::create(['name' => 'Outlet A', 'address' => 'Jl. A', 'kelurahan' => 'A', 'kecamatan' => 'A', 'status' => 'active']);
        $this->outletB = Outlet::create(['name' => 'Outlet B', 'address' => 'Jl. B', 'kelurahan' => 'B', 'kecamatan' => 'B', 'status' => 'active']);
    }

    private function completedOrder(Outlet $outlet, float $deliveryFee, array $overrides = []): Order
    {
        return Order::factory()->create(array_merge([
            'outlet_id' => $outlet->id,
            'status' => Order::STATUS_COMPLETED,
            'delivery_fee' => $deliveryFee,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
        ], $overrides));
    }

    private function attachDelivery(Order $order, string $courierType, ?float $cost): Delivery
    {
        return Delivery::create([
            'order_id' => $order->id,
            'courier_type' => $courierType,
            'courier_cost' => $cost,
            'status' => 'completed',
        ]);
    }

    public function test_returns_global_summary_and_per_outlet_rows(): void
    {
        $this->attachDelivery($this->completedOrder($this->outletA, 10000, ['fulfillment_type' => Order::FULFILLMENT_DELIVERY_OJOL]), 'eksternal', 7000);
        $this->attachDelivery($this->completedOrder($this->outletA, 8000), 'dombi', null);
        $this->attachDelivery($this->completedOrder($this->outletB, 5000), 'dombi', null);

        $result = app(CourierRevenueService::class)->revenue('harian');

        $this->assertEquals(3, $result['summary']['total_deliveries']);
        $this->assertEquals(23000, $result['summary']['delivery_fee']);
        $this->assertEquals(7000, $result['summary']['external_cost']);
        $this->assertEquals(16000, $result['summary']['net']);

        $rows = collect($result['outlets'])->keyBy('outlet.id');
        $this->assertEquals(2, $rows->count());
        $this->assertEquals(2, $rows[$this->outletA->id]['deliveries']);
        $this->assertEquals(18000, $rows[$this->outletA->id]['delivery_fee']);
        $this->assertEquals(7000, $rows[$this->outletA->id]['external_cost']);
        $this->assertEquals(11000, $rows[$this->outletA->id]['net']);
        $this->assertEquals(1, $rows[$this->outletB->id]['deliveries']);
        $this->assertEquals(5000, $rows[$this->outletB->id]['delivery_fee']);
        $this->assertEquals(0, $rows[$this->outletB->id]['external_cost']);
        $this->assertEquals(5000, $rows[$this->outletB->id]['net']);
    }

    public function test_harian_period_only_includes_today(): void
    {
        $this->attachDelivery($this->completedOrder($this->outletA, 10000), 'dombi', null);
        $this->attachDelivery($this->completedOrder($this->outletA, 9999, ['created_at' => now()->subDays(1)]), 'dombi', null);

        $result = app(CourierRevenueService::class)->revenue('harian');

        $this->assertEquals(1, $result['summary']['total_deliveries']);
        $this->assertEquals(10000, $result['summary']['delivery_fee']);
    }

    public function test_mingguan_period_uses_week_window(): void
    {
        $this->attachDelivery($this->completedOrder($this->outletA, 5000), 'dombi', null);
        $this->attachDelivery($this->completedOrder($this->outletA, 4000, ['created_at' => now()->subWeeks(2)]), 'dombi', null);

        $result = app(CourierRevenueService::class)->revenue('mingguan');

        $this->assertEquals(1, $result['summary']['total_deliveries']);
        $this->assertEquals(5000, $result['summary']['delivery_fee']);
    }

    public function test_bulanan_period_uses_month_window(): void
    {
        $this->attachDelivery($this->completedOrder($this->outletA, 7000), 'dombi', null);
        $this->attachDelivery($this->completedOrder($this->outletA, 6000, ['created_at' => now()->subMonths(2)]), 'dombi', null);

        $result = app(CourierRevenueService::class)->revenue('bulanan');

        $this->assertEquals(1, $result['summary']['total_deliveries']);
        $this->assertEquals(7000, $result['summary']['delivery_fee']);
    }

    public function test_non_completed_orders_excluded(): void
    {
        $this->attachDelivery($this->completedOrder($this->outletA, 10000, ['status' => Order::STATUS_FAILED_DELIVERY]), 'eksternal', 3000);

        $result = app(CourierRevenueService::class)->revenue('harian');

        $this->assertEquals(0, $result['summary']['total_deliveries']);
        $this->assertEquals(0, $result['summary']['delivery_fee']);
        $this->assertEquals(0, $result['summary']['external_cost']);
    }

    public function test_outlet_detail_filters_to_single_outlet(): void
    {
        $this->attachDelivery($this->completedOrder($this->outletA, 10000), 'eksternal', 4000);
        $this->attachDelivery($this->completedOrder($this->outletB, 5000), 'dombi', null);

        $detail = app(CourierRevenueService::class)->outletDetail($this->outletA->id, 'harian');

        $this->assertEquals(1, $detail['deliveries']);
        $this->assertEquals(10000, $detail['delivery_fee']);
        $this->assertEquals(4000, $detail['external_cost']);
        $this->assertEquals(6000, $detail['net']);
    }

    public function test_invalid_period_rejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        app(CourierRevenueService::class)->revenue('decade');
    }
}
