<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerCustomerTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
    }

    public function test_owner_can_list_customers(): void
    {
        Customer::factory()->create(['name' => 'Budi']);

        $response = $this->actingAs($this->owner)->get('/owner/customers');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->has('customers.data', 1)
            ->where('customers.data.0.name', 'Budi')
            ->has('customers.data.0.orders_count'));
    }

    public function test_owner_can_view_customer_detail_with_stats(): void
    {
        $customer = Customer::factory()->create(['name' => 'Siti', 'email' => 'siti@x.com']);
        $old = Order::factory()->create(['customer_id' => $customer->id, 'total' => 30000]);
        $new = Order::factory()->create(['customer_id' => $customer->id, 'total' => 50000]);

        $response = $this->actingAs($this->owner)
            ->get("/owner/customers/{$customer->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->has('orders', 2)
            ->where('stats.total_orders', 2)
            ->where('stats.total_spend', 80000)
            ->where('stats.avg_order', 40000)
            ->where('stats.last_order_at', $new->created_at->toISOString()));
    }

    public function test_customer_without_orders_shows_zero_stats(): void
    {
        $customer = Customer::factory()->create();

        $response = $this->actingAs($this->owner)
            ->get("/owner/customers/{$customer->id}");

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->where('stats.total_orders', 0)
            ->where('stats.total_spend', 0)
            ->where('stats.avg_order', 0)
            ->where('stats.last_order_at', null));
    }

    public function test_owner_cannot_view_unknown_customer(): void
    {
        $response = $this->actingAs($this->owner)->get('/owner/customers/999');

        $response->assertNotFound();
    }
}
