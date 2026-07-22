<?php

namespace Tests\Feature;

use App\Models\ExchangeRequest;
use App\Models\ExchangeRequestItem;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\RestockRequest;
use App\Models\ReturnRequest;
use App\Models\ReturnRequestItem;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerDashboardDecisionCenterTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_payload_is_reframed_as_decision_center(): void
    {
        $context = $this->makeContext();

        RestockRequest::create([
            'outlet_id' => $context['outletA']->id,
            'requested_by' => $context['outletUserA']->id,
            'status' => 'requested',
            'notes' => 'Perlu stok tambahan',
        ]);

        $return = ReturnRequest::create([
            'outlet_id' => $context['outletA']->id,
            'requested_by' => $context['outletUserA']->id,
            'reason' => 'slow_moving',
            'status' => ReturnRequest::STATUS_SUBMITTED,
            'notes' => 'Lambat bergerak',
            'total_value' => 180000,
        ]);

        ReturnRequestItem::create([
            'return_request_id' => $return->id,
            'product_variant_id' => $context['variantLarge']->id,
            'quantity' => 4,
            'unit_price' => 45000,
            'subtotal' => 180000,
        ]);

        $exchange = ExchangeRequest::create([
            'return_request_id' => $return->id,
            'outlet_id' => $context['outletA']->id,
            'requested_by' => $context['outletUserA']->id,
            'status' => ExchangeRequest::STATUS_SUBMITTED,
            'notes' => 'Tukar produk',
            'return_value' => 180000,
            'exchange_value' => 150000,
        ]);

        ExchangeRequestItem::create([
            'exchange_request_id' => $exchange->id,
            'product_variant_id' => $context['variantSmall']->id,
            'quantity' => 5,
            'unit_price' => 30000,
            'subtotal' => 150000,
        ]);

        SettlementPayment::create([
            'outlet_id' => $context['outletB']->id,
            'reference_number' => 'PAY-001',
            'payment_date' => now()->toDateString(),
            'amount' => 125000,
            'status' => SettlementPayment::STATUS_PENDING,
        ]);

        Settlement::create([
            'outlet_id' => $context['outletA']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 200000,
            'amount_due' => 180000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
        ]);

        Settlement::create([
            'outlet_id' => $context['outletB']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 280000,
            'amount_due' => 250000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
        ]);

        $this->actingAs($context['owner'])
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/dashboard')
                ->where('hero.outstandingAmount', 430000)
                ->where('hero.ctaHref', '/owner/finance')
                ->where('kpis.pendingActions', 4)
                ->where('kpis.criticalStock', 2)
                ->where('actionRequired.restocks', 1)
                ->where('actionRequired.returns', 1)
                ->where('actionRequired.exchanges', 1)
                ->where('actionRequired.pendingSettlementVerifications', 1)
                ->has('settlementAlerts', 2)
                ->has('inventoryRisks', 2)
                ->missing('deliveryStats')
                ->missing('customerStats')
                ->missing('intelligence')
                ->missing('recentActivity')
            );
    }

    public function test_settlement_alerts_rank_top_outlets_by_outstanding_amount(): void
    {
        $context = $this->makeContext();

        Settlement::create([
            'outlet_id' => $context['outletA']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 110000,
            'amount_due' => 100000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
        ]);

        Settlement::create([
            'outlet_id' => $context['outletB']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 235000,
            'amount_due' => 220000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
        ]);

        $this->actingAs($context['owner'])
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('settlementAlerts', 2)
                ->where('settlementAlerts.0.outlet.name', 'Outlet Banyumanik')
                ->where('settlementAlerts.0.outstandingAmount', 220000)
                ->where('settlementAlerts.1.outlet.name', 'Outlet Tembalang')
            );
    }

    public function test_inventory_risks_detect_critical_center_stock_using_thresholds(): void
    {
        $context = $this->makeContext();

        $this->actingAs($context['owner'])
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('inventoryRisks.0.variant.name', 'Biogoat 1L')
                ->where('inventoryRisks.0.centerStock', 8)
                ->where('inventoryRisks.0.threshold', 20)
                ->where('inventoryRisks.1.variant.name', 'Domilk Coffee 250ml')
                ->where('inventoryRisks.1.centerStock', 5)
                ->where('inventoryRisks.1.threshold', 10)
            );
    }

    private function makeContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $outletUserA = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outletUserB = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outletA = Outlet::create([
            'user_id' => $outletUserA->id,
            'name' => 'Outlet Tembalang',
            'kelurahan' => 'Tembalang',
            'kecamatan' => 'Tembalang',
            'address' => 'Jl. Tembalang',
            'status' => 'active',
        ]);

        $outletB = Outlet::create([
            'user_id' => $outletUserB->id,
            'name' => 'Outlet Banyumanik',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Banyumanik',
            'status' => 'active',
        ]);

        $outletUserA->forceFill(['outlet_id' => $outletA->id])->save();
        $outletUserB->forceFill(['outlet_id' => $outletB->id])->save();

        $family = ProductFamily::create(['name' => 'Susu Kambing', 'brand' => 'Dombi']);

        $productLarge = Product::create([
            'name' => 'Biogoat 1L',
            'slug' => uniqid('biogoat-'),
            'unit' => 'botol',
            'price' => 55000,
            'is_active' => true,
        ]);

        $productSmall = Product::create([
            'name' => 'Domilk Coffee 250ml',
            'slug' => uniqid('domilk-'),
            'unit' => 'botol',
            'price' => 30000,
            'is_active' => true,
        ]);

        $variantLarge = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $productLarge->id,
            'name' => 'Biogoat 1L',
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 45000,
            'selling_price' => 55000,
            'center_stock' => 8,
            'is_active' => true,
        ]);

        $variantSmall = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $productSmall->id,
            'name' => 'Domilk Coffee 250ml',
            'flavor' => 'Coffee',
            'size' => '250ml',
            'center_price' => 24000,
            'selling_price' => 30000,
            'center_stock' => 5,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outletA->id,
            'product_id' => $productLarge->id,
            'product_variant_id' => $variantLarge->id,
            'current_stock' => 0,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        OutletInventory::create([
            'outlet_id' => $outletB->id,
            'product_id' => $productSmall->id,
            'product_variant_id' => $variantSmall->id,
            'current_stock' => 12,
            'reserved_stock' => 0,
            'minimum_stock' => 3,
        ]);

        return compact(
            'owner',
            'outletUserA',
            'outletUserB',
            'outletA',
            'outletB',
            'variantLarge',
            'variantSmall',
        );
    }
}
