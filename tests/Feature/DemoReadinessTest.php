<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoReadinessTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_to_login_and_roles_redirect_to_own_dashboard(): void
    {
        $this->get('/')->assertRedirect('/login');

        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $customer = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        $this->actingAs($owner)->get('/customer/home')->assertRedirect('/owner/dashboard');
        $this->actingAs($customer)->get('/owner/dashboard')->assertRedirect('/customer/home');
        $this->actingAs($owner)->get('/dashboard')->assertRedirect('/owner/dashboard');
    }

    public function test_customer_cannot_view_another_customer_order(): void
    {
        $owner = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $other = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet Test', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'Address', 'status' => 'active']);
        $order = Order::create([
            'customer_id' => $owner->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-ACCESS-1',
            'status' => 'pending',
            'subtotal' => 0,
            'delivery_fee' => 0,
            'total' => 0,
            'customer_name' => $owner->name,
            'customer_phone' => '0800000000',
            'customer_address' => 'Address',
        ]);

        $this->actingAs($other)->get(route('customer.orders.show', $order))->assertForbidden();
    }

    public function test_demo_seeder_creates_login_accounts_and_sample_flow_data(): void
    {
        $this->seed(DemoSeeder::class);

        $this->assertDatabaseHas('users', ['email' => 'owner@example.com', 'role' => 'owner']);
        $this->assertDatabaseHas('users', ['email' => 'outlet.tembalang@example.com', 'role' => 'outlet']);
        $this->assertDatabaseHas('users', ['email' => 'outlet.banyumanik@example.com', 'role' => 'outlet']);
        $this->assertDatabaseHas('users', ['email' => 'courier.andi@example.com', 'role' => 'courier']);
        $this->assertDatabaseHas('orders', ['order_code' => 'DOMBI-DEMO-READY', 'status' => 'ready_for_pickup']);
        $this->assertDatabaseHas('deliveries', ['status' => 'waiting_pickup']);
        $this->assertDatabaseHas('restock_requests', ['status' => 'requested']);
        $this->assertDatabaseHas('stock_distributions', ['status' => 'shipped']);
    }

    public function test_demo_accounts_can_open_their_dashboards_only(): void
    {
        $this->seed(DemoSeeder::class);

        $owner = User::where('email', 'owner@example.com')->firstOrFail();
        $outlet = User::where('email', 'outlet.banyumanik@example.com')->firstOrFail();
        $courier = User::where('email', 'courier.andi@example.com')->firstOrFail();
        $customer = User::where('email', 'customer@example.com')->firstOrFail();

        $this->actingAs($owner)->get('/owner/dashboard')->assertOk();
        $this->actingAs($outlet)->get('/outlet/dashboard')->assertOk();
        $this->actingAs($courier)->get('/courier/dashboard')->assertOk();
        $this->actingAs($customer)->get('/customer/home')->assertOk();

        $this->actingAs($outlet)->get('/owner/dashboard')->assertRedirect('/outlet/dashboard');
        $this->actingAs($courier)->get('/outlet/dashboard')->assertRedirect('/courier/dashboard');
        $this->actingAs($customer)->get('/courier/dashboard')->assertRedirect('/customer/home');
    }
}
