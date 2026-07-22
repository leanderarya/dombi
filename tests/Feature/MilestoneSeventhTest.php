<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MilestoneSeventhTest extends TestCase
{
    use RefreshDatabase;

    // ─── OWNER DASHBOARD ─────────────────────────────────────────────

    public function test_owner_dashboard_returns_decision_center_payload(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->actingAs($owner)
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/dashboard')
                ->has('hero')
                ->has('kpis')
                ->has('actionRequired')
                ->has('settlementAlerts')
                ->has('inventoryRisks')
            );
    }

    public function test_owner_dashboard_shows_low_stock_alerts(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $family = ProductFamily::create(['name' => 'Susu', 'brand' => 'Dombi']);
        $product = Product::create(['name' => 'Susu 1L', 'slug' => 'susu-test', 'unit' => 'botol', 'price' => 25000, 'is_active' => true]);
        ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Susu 1L',
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 20000,
            'selling_price' => 25000,
            'center_stock' => 9,
            'is_active' => true,
        ]);

        $this->actingAs($owner)
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('kpis.criticalStock', 1)
                ->has('inventoryRisks', 1)
            );
    }

    // ─── OUTLET DASHBOARD ────────────────────────────────────────────

    public function test_outlet_dashboard_returns_stats_and_low_stock(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outlet = Outlet::create(['user_id' => $outletUser->id, 'name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);
        $outletUser->update(['outlet_id' => $outlet->id]);
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
                ->has('tasks')
                ->has('courier')
            );
    }

    // ─── CUSTOMER HOME ───────────────────────────────────────────────

    public function test_customer_home_returns_active_orders_and_products(): void
    {
        $this->get('/customer/home')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/home')
                ->has('activeOrders')
                ->missing('families')
            );
    }

    // ─── REPORTS ─────────────────────────────────────────────────────

    // ─── ROLE ACCESS ─────────────────────────────────────────────────

    public function test_courier_cannot_access_owner_dashboard(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);

        $this->actingAs($courier)
            ->get('/owner/dashboard')
            ->assertRedirect('/courier/dashboard');
    }
}
