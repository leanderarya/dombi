<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MilestoneSeventhTest extends TestCase
{
    use RefreshDatabase;

    // ─── OWNER DASHBOARD ─────────────────────────────────────────────

    public function test_owner_dashboard_returns_stats_and_alerts(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->actingAs($owner)
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/dashboard')
                ->has('stats')
                ->has('alerts')
                ->has('recentActivity')
                ->where('stats.pendingOrders', 0)
                ->where('stats.failedDeliveries', 0)
            );
    }

    public function test_owner_dashboard_shows_failed_delivery_alerts(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '081234567890' . rand(1000, 9999)]);
        $order = Order::create([
            'customer_id' => $customer->id, 'outlet_id' => $outlet->id, 'order_code' => 'DOMBI-TEST-0001',
            'status' => 'failed_delivery', 'subtotal' => 0, 'delivery_fee' => 0, 'total' => 0,
            'customer_name' => 'Test', 'customer_phone' => '08', 'customer_address' => 'Addr',
        ]);
        Delivery::create(['order_id' => $order->id, 'courier_id' => $courier->id, 'status' => 'failed', 'failed_reason' => 'Alamat salah']);

        $this->actingAs($owner)
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.failedDeliveries', 1)
                ->has('alerts.failedDeliveries', 1)
            );
    }

    public function test_owner_dashboard_shows_low_stock_alerts(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);
        $product = Product::create(['name' => 'Susu', 'slug' => 'susu-test', 'unit' => 'botol', 'price' => 25000, 'is_active' => true]);
        OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'current_stock' => 2, 'reserved_stock' => 1, 'minimum_stock' => 3]);

        $this->actingAs($owner)
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.lowStocks', 1)
                ->has('alerts.lowStockItems', 1)
            );
    }

    // ─── OUTLET DASHBOARD ────────────────────────────────────────────

    public function test_outlet_dashboard_returns_stats_and_low_stock(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outlet = Outlet::create(['user_id' => $outletUser->id, 'name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);
        $product = Product::create(['name' => 'Susu', 'slug' => 'susu-outlet', 'unit' => 'botol', 'price' => 25000, 'is_active' => true]);
        OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'current_stock' => 1, 'reserved_stock' => 0, 'minimum_stock' => 3]);

        $this->actingAs($outletUser)
            ->get('/outlet/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/dashboard')
                ->has('stats')
                ->has('lowStockItems', 1)
                ->has('recentOrders')
            );
    }

    // ─── COURIER DASHBOARD ───────────────────────────────────────────

    public function test_courier_dashboard_returns_stats_and_active_deliveries(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);

        $this->actingAs($courier)
            ->get('/courier/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('courier/dashboard')
                ->has('stats')
                ->has('activeDeliveries')
            );
    }

    // ─── CUSTOMER HOME ───────────────────────────────────────────────

    public function test_customer_home_returns_active_orders_and_products(): void
    {
        $this->get('/customer/home')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/home')
                ->has('products')
                ->has('activeOrders')
            );
    }

    // ─── REPORTS ─────────────────────────────────────────────────────

    public function test_owner_reports_page_accessible(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->actingAs($owner)
            ->get('/owner/reports')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/reports/index')
                ->has('summary')
                ->has('ordersByStatus')
                ->has('deliveriesByStatus')
                ->has('outlets')
                ->has('filters')
            );
    }

    public function test_owner_reports_with_date_filter(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->actingAs($owner)
            ->get('/owner/reports?date_from=2026-05-01&date_to=2026-05-24')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('filters.date_from', '2026-05-01')
                ->where('filters.date_to', '2026-05-24')
            );
    }

    public function test_owner_reports_csv_export(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '081234567890' . rand(1000, 9999)]);
        Order::create([
            'customer_id' => $customer->id, 'outlet_id' => $outlet->id, 'order_code' => 'DOMBI-CSV-0001',
            'status' => 'completed', 'subtotal' => 50000, 'delivery_fee' => 0, 'total' => 50000,
            'customer_name' => 'Test', 'customer_phone' => '08', 'customer_address' => 'Addr',
        ]);

        $response = $this->actingAs($owner)
            ->get('/owner/reports/export-csv')
            ->assertOk();

        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
    }

    public function test_non_owner_cannot_access_reports(): void
    {
        $outlet = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $this->actingAs($outlet)
            ->get('/owner/reports')
            ->assertRedirect('/outlet/dashboard');
    }

    // ─── ROLE ACCESS ─────────────────────────────────────────────────

    public function test_courier_cannot_access_owner_dashboard(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);

        $this->actingAs($courier)
            ->get('/owner/dashboard')
            ->assertRedirect('/courier/dashboard');
    }
}
