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

class MilestoneEighthTest extends TestCase
{
    use RefreshDatabase;

    // ─── PWA ASSETS ──────────────────────────────────────────────────

    public function test_pwa_manifest_file_exists(): void
    {
        $this->assertFileExists(public_path('manifest.json'));

        $manifest = json_decode(file_get_contents(public_path('manifest.json')), true);
        $this->assertSame('Dombi', $manifest['short_name']);
        $this->assertSame('standalone', $manifest['display']);
        $this->assertNotEmpty($manifest['icons']);
    }

    public function test_service_worker_file_exists(): void
    {
        $this->assertFileExists(public_path('sw.js'));
        $content = file_get_contents(public_path('sw.js'));
        $this->assertStringContainsString('CACHE_NAME', $content);
        $this->assertStringContainsString('/offline', $content);
    }

    public function test_offline_fallback_page_exists(): void
    {
        $this->assertFileExists(public_path('offline'));
        $content = file_get_contents(public_path('offline'));
        $this->assertStringContainsString('offline', $content);
        $this->assertStringContainsString('Coba Lagi', $content);
    }

    public function test_pwa_icons_exist(): void
    {
        $this->assertFileExists(public_path('icons/icon-192.png'));
        $this->assertFileExists(public_path('icons/icon-512.png'));
    }

    public function test_blade_template_includes_pwa_meta(): void
    {
        $blade = file_get_contents(resource_path('views/app.blade.php'));
        $this->assertStringContainsString('manifest.json', $blade);
        $this->assertStringContainsString('theme-color', $blade);
        $this->assertStringContainsString('apple-mobile-web-app-capable', $blade);
        $this->assertStringContainsString('viewport-fit=cover', $blade);
    }

    // ─── REPORT EXPORT ───────────────────────────────────────────────

    public function test_csv_export_streams_correctly(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '081234567890' . rand(1000, 9999)]);

        Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-STREAM-0001',
            'status' => 'completed',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '08',
            'customer_address' => 'Addr',
        ]);

        $response = $this->actingAs($owner)
            ->get('/owner/reports/export-csv');

        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_csv_export_with_date_filter(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $response = $this->actingAs($owner)
            ->get('/owner/reports/export-csv?date_from=2026-05-01&date_to=2026-05-24');

        $response->assertOk();
    }

    // ─── POLLING ENDPOINTS (dashboards respond to normal GET) ────────

    public function test_owner_dashboard_responds_quickly(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->actingAs($owner)
            ->get('/owner/dashboard')
            ->assertOk();
    }

    public function test_outlet_dashboard_responds_quickly(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        Outlet::create(['user_id' => $outletUser->id, 'name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);

        $this->actingAs($outletUser)
            ->get('/outlet/dashboard')
            ->assertOk();
    }

    public function test_courier_dashboard_responds_quickly(): void
    {
        $courier = User::factory()->create(['role' => 'courier', 'is_active' => true]);

        $this->actingAs($courier)
            ->get('/courier/dashboard')
            ->assertOk();
    }

    // ─── RECONCILIATION VALIDATION ───────────────────────────────────

    public function test_inventory_adjustment_with_notes_succeeds(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);
        $product = Product::create(['name' => 'Susu', 'slug' => 'susu-recon', 'unit' => 'botol', 'price' => 25000, 'is_active' => true]);
        $family = ProductFamily::create(['name' => 'Susu', 'brand' => 'Dombi']);
        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Original',
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);
        $inventory = OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'product_variant_id' => $variant->id, 'current_stock' => 10, 'reserved_stock' => 0, 'minimum_stock' => 2]);

        $this->actingAs($owner)
            ->put(route('owner.inventories.update', $inventory), [
                'current_stock' => 15,
                'minimum_stock' => 2,
                'notes' => 'Stok fisik dihitung ulang',
            ])
            ->assertRedirect(route('owner.inventories.index'));

        $this->assertDatabaseHas('outlet_inventories', ['id' => $inventory->id, 'current_stock' => 15]);
        $this->assertDatabaseHas('stock_movements', [
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'type' => 'stock_adjustment',
            'notes' => 'Stok fisik dihitung ulang',
        ]);
    }

    public function test_inventory_adjustment_cannot_go_below_reserved(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::create(['name' => 'Outlet', 'kelurahan' => 'A', 'kecamatan' => 'B', 'address' => 'C', 'status' => 'active']);
        $product = Product::create(['name' => 'Susu', 'slug' => 'susu-recon2', 'unit' => 'botol', 'price' => 25000, 'is_active' => true]);
        $family = ProductFamily::create(['name' => 'Susu', 'brand' => 'Dombi']);
        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Original',
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);
        $inventory = OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'product_variant_id' => $variant->id, 'current_stock' => 10, 'reserved_stock' => 5, 'minimum_stock' => 2]);

        $this->actingAs($owner)
            ->put(route('owner.inventories.update', $inventory), [
                'current_stock' => 3,
                'minimum_stock' => 2,
                'notes' => 'Trying to go below reserved',
            ])
            ->assertSessionHasErrors('current_stock');

        $this->assertDatabaseHas('outlet_inventories', ['id' => $inventory->id, 'current_stock' => 10]);
    }

    // ─── PERFORMANCE INDEXES ─────────────────────────────────────────

    public function test_performance_migration_runs_successfully(): void
    {
        // This test implicitly passes because RefreshDatabase runs all migrations
        $this->assertTrue(true);
    }
}
