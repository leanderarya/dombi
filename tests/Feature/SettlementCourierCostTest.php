<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Services\SettlementReconciliationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettlementCourierCostTest extends TestCase
{
    use RefreshDatabase;

    public function test_reconciliation_includes_courier_costs(): void
    {
        $outlet = Outlet::create([
            'name' => 'Test Outlet',
            'address' => 'Jl. Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'status' => 'active',
        ]);

        $order1 = Order::create([
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-SET-001',
            'status' => Order::STATUS_COMPLETED,
            'delivery_fee' => 15000,
            'subtotal' => 50000,
            'total' => 65000,
            'customer_name' => 'Test',
            'customer_phone' => '081234567890',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now()->subDays(5),
        ]);

        $order2 = Order::create([
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-SET-002',
            'status' => Order::STATUS_COMPLETED,
            'delivery_fee' => 15000,
            'subtotal' => 50000,
            'total' => 65000,
            'customer_name' => 'Test',
            'customer_phone' => '081234567890',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now()->subDays(3),
        ]);

        Delivery::create([
            'order_id' => $order1->id,
            'courier_type' => 'eksternal',
            'status' => 'completed',
            'external_courier_name' => 'Gojek',
            'courier_cost' => 25000,
        ]);

        Delivery::create([
            'order_id' => $order2->id,
            'courier_type' => 'dombi',
            'status' => 'completed',
        ]);

        $service = app(SettlementReconciliationService::class);
        $result = $service->getOutletReconciliation($outlet->id);

        $this->assertEquals(30000, $result['total_delivery_fee']);
        $this->assertEquals(25000, $result['eksternal_courier_cost']);
        $this->assertEquals(1, $result['eksternal_delivery_count']);
        $this->assertEquals(5000, $result['net_delivery_income']);
    }
}