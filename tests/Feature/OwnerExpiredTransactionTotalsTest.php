<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerExpiredTransactionTotalsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
    }

    public function test_orders_page_total_today_excludes_expired(): void
    {
        Order::factory()->create([
            'status' => Order::STATUS_COMPLETED,
            'payment_status' => 'paid',
            'created_at' => now(),
        ]);
        Order::factory()->create([
            'status' => Order::STATUS_EXPIRED,
            'payment_status' => null,
            'created_at' => now(),
        ]);

        $this->actingAs($this->owner)
            ->get('/owner/orders')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.total_today', 1));
    }

    public function test_dashboard_orders_today_excludes_expired(): void
    {
        Order::factory()->create([
            'status' => Order::STATUS_COMPLETED,
            'payment_status' => 'paid',
            'created_at' => now(),
        ]);
        Order::factory()->create([
            'status' => Order::STATUS_EXPIRED,
            'payment_status' => null,
            'created_at' => now(),
        ]);

        $this->actingAs($this->owner)
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('kpis.ordersToday', 1));
    }

    public function test_analytics_total_orders_excludes_expired_but_keeps_the_status_row(): void
    {
        Order::factory()->create([
            'status' => Order::STATUS_COMPLETED,
            'payment_status' => 'paid',
            'total' => 25000,
        ]);
        Order::factory()->create([
            'status' => Order::STATUS_EXPIRED,
            'payment_status' => null,
        ]);

        $this->actingAs($this->owner)
            ->get('/owner/analytics?tab=laporan')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('summary.totalOrders', 1)
                ->where('ordersByStatus.expired', 1));
    }

    public function test_cancelled_filter_excludes_expired(): void
    {
        Order::factory()->create([
            'status' => Order::STATUS_CANCELLED_BY_OUTLET,
            'payment_status' => 'paid',
        ]);
        $expired = Order::factory()->create([
            'status' => Order::STATUS_EXPIRED,
            'payment_status' => null,
        ]);

        $response = $this->actingAs($this->owner)->get('/owner/orders?status=cancelled');
        $response->assertOk();

        $ids = collect($response->viewData('page')['props']['orders']['data'])->pluck('id');

        $this->assertCount(1, $ids);
        $this->assertFalse($ids->contains($expired->id));
    }

    public function test_expired_filter_lists_only_expired_orders(): void
    {
        Order::factory()->create([
            'status' => Order::STATUS_CANCELLED_BY_OUTLET,
            'payment_status' => 'paid',
        ]);
        $expired = Order::factory()->create([
            'status' => Order::STATUS_EXPIRED,
            'payment_status' => null,
        ]);

        $this->actingAs($this->owner)
            ->get('/owner/orders?status=expired')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('orders.data', 1)
                ->where('orders.data.0.id', $expired->id));
    }
}
