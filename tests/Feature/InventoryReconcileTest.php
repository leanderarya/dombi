<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class InventoryReconcileTest extends TestCase
{
    use RefreshDatabase;

    // ─── HEALTHY INVENTORY ──────────────────────────────────────────

    public function test_healthy_inventory_passes_reconciliation(): void
    {
        $ctx = $this->makeContext(centerStock: 50, outletStock: 20);

        // Center baseline: return_in +50
        // Distribution: distribution_out -50 (center drops to 0)
        // But center_stock says 50 — so we DON'T create distribution here.
        // Instead, center has 50 and outlet has 20, both from baselines only.

        $exitCode = Artisan::call('inventory:reconcile');
        $output = Artisan::output();

        $this->assertSame(0, $exitCode, "Reconciliation failed with output:\n".$output);
        $this->assertStringContainsString('No drift detected', $output);
    }

    // ─── CENTER DRIFT DETECTION ────────────────────────────────────

    public function test_detects_center_stock_drift(): void
    {
        $ctx = $this->makeContext(centerStock: 50, outletStock: 10);

        // Tamper: center_stock is 50 but we set it to 999
        $ctx['variant']->update(['center_stock' => 999]);

        $exitCode = Artisan::call('inventory:reconcile');

        $this->assertSame(1, $exitCode);
        $output = Artisan::output();
        $this->assertStringContainsString('Drifted: 1', $output);
    }

    // ─── OUTLET DRIFT DETECTION ────────────────────────────────────

    public function test_detects_outlet_stock_drift(): void
    {
        $ctx = $this->makeContext(centerStock: 50, outletStock: 20);

        // Movement says outlet +20, tamper to 999
        $this->createRestockMovement($ctx, 20);
        $ctx['inventory']->update(['current_stock' => 999]);

        $exitCode = Artisan::call('inventory:reconcile');

        $this->assertSame(1, $exitCode);
        $output = Artisan::output();
        $this->assertStringContainsString('Drifted: 1', $output);
    }

    // ─── FIX MODE ──────────────────────────────────────────────────

    public function test_fix_mode_corrects_drift_and_creates_movement(): void
    {
        $ctx = $this->makeContext(centerStock: 50, outletStock: 20);

        // Add restock movement: outlet +20
        $this->createRestockMovement($ctx, 20);

        // Tamper outlet stock to 999
        $ctx['inventory']->update(['current_stock' => 999]);

        $exitCode = Artisan::call('inventory:reconcile', ['--fix' => true]);
        $output = Artisan::output();

        // Fix reports drifts but corrects them (exit code 1 = drift was found)
        $this->assertStringContainsString('Fixed: 1', $output);

        // Expected outlet = 20 initial + 20 restock = 40
        $this->assertSame(40, (int) $ctx['inventory']->fresh()->current_stock);

        // Adjustment movement created
        $this->assertDatabaseHas('stock_movements', [
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'stock_adjustment',
            'notes' => 'Outlet inventory reconciliation correction',
        ]);
    }

    public function test_fix_mode_corrects_center_drift(): void
    {
        $ctx = $this->makeContext(centerStock: 50, outletStock: 10);

        // Tamper center_stock to 0
        $ctx['variant']->update(['center_stock' => 0]);

        $exitCode = Artisan::call('inventory:reconcile', ['--fix' => true]);
        $output = Artisan::output();

        // Fix reports drifts but corrects them
        $this->assertStringContainsString('Fixed: 1', $output);

        // Should be corrected back to 50 (from baseline return_in)
        $this->assertSame(50, (int) $ctx['variant']->fresh()->center_stock);

        $this->assertDatabaseHas('stock_movements', [
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'stock_adjustment',
            'notes' => 'Center stock reconciliation correction',
        ]);
    }

    // ─── DRY RUN ───────────────────────────────────────────────────

    public function test_dry_run_does_not_modify_data(): void
    {
        $ctx = $this->makeContext(centerStock: 50, outletStock: 20);

        $this->createRestockMovement($ctx, 20);
        $ctx['inventory']->update(['current_stock' => 999]);

        $exitCode = Artisan::call('inventory:reconcile', ['--dry-run' => true]);

        $this->assertSame(1, $exitCode);
        // Stock NOT corrected
        $this->assertSame(999, (int) $ctx['inventory']->fresh()->current_stock);
        // No adjustment movement
        $this->assertSame(0, StockMovement::where('type', 'stock_adjustment')->count());
    }

    // ─── CONSERVATION AUDIT ────────────────────────────────────────

    public function test_detects_conservation_violation(): void
    {
        $ctx = $this->makeContext(centerStock: 50, outletStock: 20);

        // Center baseline: return_in +50, so expected center = 50
        // Outlet baseline: initial_stock +20, so expected outlet = 20
        // Expected total = 70, actual = 70 → OK

        // Now tamper outlet to 0 without removing the movement
        // This creates a conservation violation: expected=70, actual=50
        $ctx['inventory']->update(['current_stock' => 0]);

        $exitCode = Artisan::call('inventory:reconcile');

        $this->assertSame(1, $exitCode);
        $output = Artisan::output();
        $this->assertStringContainsString('CONSERVATION VIOLATIONS', $output);
    }

    // ─── RETURN FLOW RECONCILIATION ────────────────────────────────

    public function test_return_flow_reconciles_correctly(): void
    {
        $ctx = $this->makeContext(centerStock: 100, outletStock: 20);

        // Center baseline: return_in +100 (from makeContext)
        // Simulate return: outlet -5, center +5
        StockMovement::create([
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'return_out',
            'quantity' => -5,
            'before_stock' => 20,
            'after_stock' => 15,
            'before_reserved' => 0,
            'after_reserved' => 0,
        ]);

        StockMovement::create([
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'return_in',
            'quantity' => 5,
            'before_stock' => 100,
            'after_stock' => 105,
            'before_reserved' => 0,
            'after_reserved' => 0,
        ]);

        // Update actual stock to match
        $ctx['variant']->update(['center_stock' => 105]); // 100 + 5
        $ctx['inventory']->update(['current_stock' => 15]); // 20 - 5

        $exitCode = Artisan::call('inventory:reconcile');
        $output = Artisan::output();
        $this->assertSame(0, $exitCode, "Reconciliation failed:\n".$output);
    }

    // ─── EXCHANGE FLOW RECONCILIATION ──────────────────────────────

    public function test_exchange_flow_reconciles_correctly(): void
    {
        $ctx = $this->makeContext(centerStock: 50, outletStock: 20);
        $exchangeVariant = $ctx['exchangeVariant'];
        $exchangeInventory = $ctx['exchangeInventory'];

        // Center baseline for main variant: return_in +50 (from makeContext)
        // Center baseline for exchange variant: need to create one
        StockMovement::create([
            'outlet_id' => null,
            'product_variant_id' => $exchangeVariant->id,
            'type' => 'return_in',
            'quantity' => 8,
            'before_stock' => 0,
            'after_stock' => 8,
            'notes' => 'Exchange variant center baseline',
        ]);

        // Return: outlet -5, center +5
        StockMovement::create([
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'return_out', 'quantity' => -5,
            'before_stock' => 20, 'after_stock' => 15,
            'before_reserved' => 0, 'after_reserved' => 0,
        ]);
        StockMovement::create([
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'return_in', 'quantity' => 5,
            'before_stock' => 50, 'after_stock' => 55,
            'before_reserved' => 0, 'after_reserved' => 0,
        ]);

        // Exchange: center -8, outlet +8
        StockMovement::create([
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $exchangeVariant->id,
            'type' => 'exchange_out', 'quantity' => -8,
            'before_stock' => 8, 'after_stock' => 0,
            'before_reserved' => 0, 'after_reserved' => 0,
        ]);
        StockMovement::create([
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $exchangeVariant->id,
            'type' => 'exchange_in', 'quantity' => 8,
            'before_stock' => 10, 'after_stock' => 18,
            'before_reserved' => 0, 'after_reserved' => 0,
        ]);

        // Set actual stocks to match movement totals
        $ctx['variant']->update(['center_stock' => 55]); // 50 baseline + 5 return_in
        $ctx['inventory']->update(['current_stock' => 15]); // 20 initial - 5 return_out
        $exchangeVariant->update(['center_stock' => 0]); // 8 baseline - 8 exchange_out
        $exchangeInventory->update(['current_stock' => 18]); // 10 initial + 8 exchange_in

        $exitCode = Artisan::call('inventory:reconcile');
        $output = Artisan::output();
        $this->assertSame(0, $exitCode, "Reconciliation failed:\n".$output);
    }

    // ─── DISTRIBUTION FLOW RECONCILIATION ──────────────────────────

    public function test_distribution_flow_reconciles_correctly(): void
    {
        $ctx = $this->makeContext(centerStock: 100, outletStock: 10);

        // Center baseline: return_in +100 (from makeContext)
        // Distribution: center -15, outlet +15
        StockMovement::create([
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'distribution_out', 'quantity' => -15,
            'before_stock' => 100, 'after_stock' => 85,
            'before_reserved' => 0, 'after_reserved' => 0,
        ]);
        StockMovement::create([
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'restock_in', 'quantity' => 15,
            'before_stock' => 10, 'after_stock' => 25,
            'before_reserved' => 0, 'after_reserved' => 0,
        ]);

        // Update actual stocks to match
        $ctx['variant']->update(['center_stock' => 85]); // 100 - 15
        $ctx['inventory']->update(['current_stock' => 25]); // 10 + 15

        $exitCode = Artisan::call('inventory:reconcile');
        $output = Artisan::output();
        $this->assertSame(0, $exitCode, "Reconciliation failed:\n".$output);
    }

    // ─── MULTI-OUTLET ──────────────────────────────────────────────

    public function test_multi_outlet_reconciliation(): void
    {
        $ctx = $this->makeContext(centerStock: 100, outletStock: 20);

        // Create second outlet
        $outlet2 = Outlet::create([
            'user_id' => User::factory()->create(['role' => 'outlet'])->id,
            'name' => 'Outlet 2',
            'kelurahan' => 'Test', 'kecamatan' => 'Test', 'address' => 'Test',
            'status' => 'active',
        ]);

        $inventory2 = OutletInventory::create([
            'outlet_id' => $outlet2->id,
            'product_id' => $ctx['variant']->product_id,
            'product_variant_id' => $ctx['variant']->id,
            'current_stock' => 30,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        // Movement for outlet 2
        StockMovement::create([
            'outlet_id' => $outlet2->id,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'restock_in', 'quantity' => 30,
            'before_stock' => 0, 'after_stock' => 30,
            'before_reserved' => 0, 'after_reserved' => 0,
        ]);

        // Movement for outlet 1 (initial_stock already exists from makeContext)

        $exitCode = Artisan::call('inventory:reconcile');
        $this->assertSame(0, $exitCode);
        $output = Artisan::output();
        $this->assertStringContainsString('Checked: 3 inventories', $output);
    }

    public function test_outlet_filter_limits_check(): void
    {
        $ctx = $this->makeContext(centerStock: 50, outletStock: 20);

        $exitCode = Artisan::call('inventory:reconcile', ['--outlet' => $ctx['outlet']->id]);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode, "Reconciliation failed:\n".$output);
        $this->assertStringContainsString('No drift detected', $output);
        // Outlet filter only limits outlet inventories, center still checks all
        $this->assertStringContainsString('Checked: 2 inventories', $output);
    }

    // ─── HELPERS ───────────────────────────────────────────────────

    private function makeContext(int $centerStock = 50, int $outletStock = 20): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Reconcile Test Outlet',
            'kelurahan' => 'Test', 'kecamatan' => 'Test', 'address' => 'Test',
            'status' => 'active',
        ]);

        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();

        $product = Product::create([
            'name' => 'Test Product',
            'slug' => uniqid('reconcile-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create(['name' => 'Test Family', 'brand' => 'Test']);

        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Original 500ml',
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'center_stock' => $centerStock,
            'is_active' => true,
        ]);

        $inventory = OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'current_stock' => $outletStock,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        // Create initial stock movement to establish baseline
        if ($outletStock > 0) {
            StockMovement::create([
                'outlet_id' => $outlet->id,
                'product_variant_id' => $variant->id,
                'type' => 'initial_stock',
                'quantity' => $outletStock,
                'before_stock' => 0,
                'after_stock' => $outletStock,
                'before_reserved' => 0,
                'after_reserved' => 0,
                'notes' => 'Initial outlet stock',
            ]);
        }

        // Create initial center stock movement (return_in as baseline)
        if ($centerStock > 0) {
            StockMovement::create([
                'outlet_id' => null,
                'product_variant_id' => $variant->id,
                'type' => 'return_in',
                'quantity' => $centerStock,
                'before_stock' => 0,
                'after_stock' => $centerStock,
                'before_reserved' => 0,
                'after_reserved' => 0,
                'notes' => 'Initial center stock baseline',
            ]);
        }

        // Exchange variant
        $exchangeProduct = Product::create([
            'name' => 'Exchange Product',
            'slug' => uniqid('exchange-'),
            'unit' => 'botol',
            'price' => 30000,
            'is_active' => true,
        ]);

        $exchangeVariant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $exchangeProduct->id,
            'name' => 'Exchange 250ml',
            'flavor' => 'Coffee',
            'size' => '250ml',
            'center_price' => 20000,
            'selling_price' => 30000,
            'center_stock' => 0,
            'is_active' => true,
        ]);

        $exchangeInventory = OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $exchangeProduct->id,
            'product_variant_id' => $exchangeVariant->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        StockMovement::create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $exchangeVariant->id,
            'type' => 'initial_stock',
            'quantity' => 10,
            'before_stock' => 0,
            'after_stock' => 10,
            'before_reserved' => 0,
            'after_reserved' => 0,
            'notes' => 'Initial stock',
        ]);

        return compact('owner', 'outletUser', 'outlet', 'variant', 'inventory', 'exchangeVariant', 'exchangeInventory');
    }

    private function createDistributionMovement(array $ctx, int $qty): void
    {
        StockMovement::create([
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'distribution_out',
            'quantity' => -$qty,
            'before_stock' => $qty + 50,
            'after_stock' => 50,
            'before_reserved' => 0,
            'after_reserved' => 0,
        ]);
    }

    private function createRestockMovement(array $ctx, int $qty): void
    {
        StockMovement::create([
            'outlet_id' => $ctx['outlet']->id,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'restock_in',
            'quantity' => $qty,
            'before_stock' => 0,
            'after_stock' => $qty,
            'before_reserved' => 0,
            'after_reserved' => 0,
        ]);
    }

    private function createCenterBaseline(array $ctx, int $qty): void
    {
        StockMovement::create([
            'outlet_id' => null,
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'return_in',
            'quantity' => $qty,
            'before_stock' => 0,
            'after_stock' => $qty,
            'before_reserved' => 0,
            'after_reserved' => 0,
            'notes' => 'Center stock baseline',
        ]);
    }
}
