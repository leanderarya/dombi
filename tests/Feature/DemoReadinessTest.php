<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoReadinessTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_opens_storefront(): void
    {
        $this->get('/')->assertOk();
    }

    public function test_owner_redirects_to_own_dashboard(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->actingAs($owner)->get('/customer/home')->assertRedirect('/owner/dashboard');
        $this->actingAs($owner)->get('/dashboard')->assertRedirect('/owner/dashboard');
    }

    public function test_demo_seeder_creates_login_accounts_and_sample_flow_data(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseHas('users', ['email' => 'owner@example.com', 'role' => 'owner']);
        $this->assertDatabaseHas('users', ['email' => 'outlet.tembalang@example.com', 'role' => 'outlet']);
        $this->assertDatabaseHas('users', ['email' => 'outlet.banyumanik@example.com', 'role' => 'outlet']);
        $this->assertDatabaseHas('users', ['email' => 'courier.andi@example.com', 'role' => 'courier']);
        $this->assertDatabaseHas('customers', ['phone' => '6284100000001', 'name' => 'Customer Demo']);
        $this->assertDatabaseHas('orders', ['order_code' => 'DOMBI-DEMO-READY', 'status' => 'ready_for_pickup']);
        $this->assertDatabaseHas('deliveries', ['status' => 'waiting_pickup']);
        $this->assertDatabaseHas('restock_requests', ['status' => 'requested']);
        $this->assertDatabaseHas('stock_distributions', ['status' => 'shipped']);
    }

    public function test_demo_accounts_can_open_their_dashboards_only(): void
    {
        $this->seed(DatabaseSeeder::class);

        $owner = User::where('email', 'owner@example.com')->firstOrFail();
        $outlet = User::where('email', 'outlet.banyumanik@example.com')->firstOrFail();
        $courier = User::where('email', 'courier.andi@example.com')->firstOrFail();

        $this->actingAs($owner)->get('/owner/dashboard')->assertOk();
        $this->actingAs($outlet)->get('/outlet/dashboard')->assertOk();
        $this->actingAs($courier)->get('/courier/dashboard')->assertOk();

        $this->actingAs($outlet)->get('/owner/dashboard')->assertRedirect('/outlet/dashboard');
        $this->actingAs($courier)->get('/outlet/dashboard')->assertRedirect('/courier/dashboard');
    }
}
