<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierManagementRevenueTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
        $this->outlet = Outlet::create(['name' => 'Test Outlet', 'address' => 'Jl. Test', 'kelurahan' => 'Test', 'kecamatan' => 'Test', 'status' => 'active']);
    }

    private function completedOrder(float $fee, array $overrides = []): Order
    {
        return Order::factory()->create(array_merge([
            'outlet_id' => $this->outlet->id,
            'status' => Order::STATUS_COMPLETED,
            'delivery_fee' => $fee,
        ], $overrides));
    }

    public function test_index_returns_revenue_summary_and_outlet_rows(): void
    {
        $order = $this->completedOrder(10000, ['fulfillment_type' => Order::FULFILLMENT_DELIVERY_OJOL]);
        Delivery::create(['order_id' => $order->id, 'courier_type' => 'eksternal', 'courier_cost' => 7000, 'status' => 'completed']);

        $response = $this->actingAs($this->owner)->get('/owner/couriers/management');

        $response->assertInertia(fn ($page) => $page
            ->component('owner/courier-management/index')
            ->has('revenueSummary')
            ->where('revenueSummary.deliveries', 1)
            ->where('revenueSummary.delivery_fee', 10000)
            ->where('revenueSummary.external_cost', 7000)
            ->where('revenueSummary.net', 3000)
            ->has('revenueOutlets', 1)
            ->where('revenueOutlets.0.outlet.id', $this->outlet->id)
            ->where('revenueOutlets.0.deliveries', 1)
            ->where('revenueOutlets.0.delivery_fee', 10000)
            ->where('revenueOutlets.0.external_cost', 7000)
            ->where('revenueOutlets.0.net', 3000)
        );
    }

    public function test_index_validates_period_param(): void
    {
        $response = $this->actingAs($this->owner)->get('/owner/couriers/management?period=decade');

        $response->assertSessionHasErrors('period');
    }

    public function test_index_accepts_each_period(): void
    {
        $order = $this->completedOrder(10000);
        Delivery::create(['order_id' => $order->id, 'courier_type' => 'dombi', 'courier_cost' => null, 'status' => 'completed']);

        foreach (['harian', 'mingguan', 'bulanan'] as $period) {
            $this->actingAs($this->owner)
                ->get("/owner/couriers/management?period={$period}")
                ->assertInertia(fn ($page) => $page
                    ->where('revenueSummary.deliveries', 1)
                    ->where('revenueSummary.delivery_fee', 10000)
                );
        }
    }
}
