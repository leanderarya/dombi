<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Carbon\Carbon;
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

    public function test_index_filters_by_period(): void
    {
        // Pin to a date in the first 3 days of a month so relative periods are deterministic
        // (harian=1, mingguan=2, bulanan=1 are only consistent when the 3-day-old order
        // falls in the prior month but same week). Avoids the Monday/week-boundary flake.
        Carbon::setTestNow('2026-07-02 10:00:00');

        Delivery::create(['order_id' => $this->completedOrder(10000)->id, 'courier_type' => 'dombi', 'courier_cost' => null, 'status' => 'completed']);
        Delivery::create(['order_id' => $this->completedOrder(4000, ['created_at' => now()->subDays(3)])->id, 'courier_type' => 'dombi', 'courier_cost' => null, 'status' => 'completed']);
        Delivery::create(['order_id' => $this->completedOrder(2000, ['created_at' => now()->subDays(45)])->id, 'courier_type' => 'dombi', 'courier_cost' => null, 'status' => 'completed']);

        $periods = [
            'harian' => [1, 10000],
            'mingguan' => [2, 14000],
            'bulanan' => [1, 10000],
        ];

        foreach ($periods as $period => [$count, $fee]) {
            $this->actingAs($this->owner)
                ->get("/owner/couriers/management?period={$period}")
                ->assertInertia(fn ($page) => $page
                    ->component('owner/courier-management/index')
                    ->where('revenueSummary.deliveries', $count)
                    ->where('revenueSummary.delivery_fee', $fee)
                );
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }
}
