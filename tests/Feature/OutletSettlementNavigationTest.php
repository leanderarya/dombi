<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\SettlementPayment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletSettlementNavigationTest extends TestCase
{
    use RefreshDatabase;

    private array $context;

    protected function setUp(): void
    {
        parent::setUp();

        $this->context = $this->makeOutletContext();
    }

    // ─── ROUTE ACCESS ──────────────────────────────────────────────

    public function test_outlet_can_access_settlement_page(): void
    {
        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/settlement')
                ->has('summary')
                ->has('reconciliation')
                ->has('payments')
                ->has('timeline')
                ->has('period')
            );
    }

    public function test_outlet_can_access_settlement_with_period_filter(): void
    {
        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement?period=today')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('period', 'today')
            );
    }

    public function test_outlet_settlement_requires_auth(): void
    {
        $this->get('/outlet/settlement')
            ->assertRedirect('/login');
    }

    public function test_owner_cannot_access_outlet_settlement(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);

        $this->actingAs($owner)
            ->get('/outlet/settlement')
            ->assertRedirect('/owner/dashboard');
    }

    // ─── DASHBOARD SETTLEMENT STATS ────────────────────────────────

    public function test_dashboard_passes_settlement_stats(): void
    {
        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/dashboard')
                ->has('settlementStats', fn ($stats) => $stats
                    ->has('outstanding')
                    ->has('pendingPayments')
                    ->has('verifiedPayments')
                    ->has('margin')
                )
            );
    }

    public function test_dashboard_shows_outstanding_when_unpaid(): void
    {
        // Create a sale payable to generate outstanding
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 80000,
            'outlet_margin' => 20000,
            'notes' => 'Test sale',
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('settlementStats.outstanding', 80000)
            );
    }

    public function test_dashboard_shows_verified_payments(): void
    {
        // Create a verified payment within this month
        SettlementPayment::create([
            'outlet_id' => $this->context['outlet']->id,
            'amount' => 50000,
            'reference_number' => 'TRF-001',
            'payment_date' => now()->toDateString(),
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('settlementStats')
            );
    }

    // ─── SETTLEMENT PAGE DATA ──────────────────────────────────────

    public function test_settlement_page_shows_outstanding(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 200000,
            'center_share' => 160000,
            'outlet_margin' => 40000,
            'notes' => 'Test sale',
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('reconciliation')
                ->has('summary')
                ->where('summary.orders_count', 1)
            );
    }

    public function test_settlement_page_shows_empty_state_with_no_sales(): void
    {
        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('summary.orders_count', 0)
                ->where('summary.gross_revenue', 0)
            );
    }

    // ─── PAYMENT SUBMISSION ────────────────────────────────────────

    public function test_outlet_can_submit_payment(): void
    {
        $this->actingAs($this->context['outletUser'])
            ->post('/outlet/settlement-payments', [
                'amount' => 50000,
                'reference_number' => 'TRF-TEST-001',
                'payment_date' => now()->toDateString(),
                'notes' => 'Transfer test',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('settlement_payments', [
            'outlet_id' => $this->context['outlet']->id,
            'amount' => 50000,
            'reference_number' => 'TRF-TEST-001',
            'status' => SettlementPayment::STATUS_PENDING,
        ]);
    }

    public function test_payment_requires_amount(): void
    {
        $this->actingAs($this->context['outletUser'])
            ->post('/outlet/settlement-payments', [
                'reference_number' => 'TRF-TEST-002',
                'payment_date' => now()->toDateString(),
            ])
            ->assertSessionHasErrors('amount');
    }

    // ─── NAVIGATION CONSISTENCY ────────────────────────────────────

    public function test_settlement_route_exists_in_outlet_middleware(): void
    {
        // Verify the route is registered and accessible by outlet role
        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk();
    }

    public function test_settlement_payment_routes_exist(): void
    {
        // GET index
        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement-payments')
            ->assertOk();

        // POST store
        $this->actingAs($this->context['outletUser'])
            ->post('/outlet/settlement-payments', [
                'amount' => 10000,
                'reference_number' => 'TRF-ROUTE-TEST',
                'payment_date' => now()->toDateString(),
            ])
            ->assertRedirect();
    }

    // ─── OUTSTANDING CALCULATION ──────────────────────────────────

    public function test_outstanding_equals_center_share_when_no_payments(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 85000,
            'outlet_margin' => 15000,
            'notes' => 'Test sale',
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reconciliation.outstanding', 85000)
                ->where('reconciliation.center_share', 85000)
                ->where('reconciliation.verified_payments', 0)
            );
    }

    public function test_outstanding_decreases_after_verified_payment(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 85000,
            'outlet_margin' => 15000,
            'notes' => 'Test sale',
        ]);

        SettlementPayment::create([
            'outlet_id' => $this->context['outlet']->id,
            'amount' => 50000,
            'reference_number' => 'TRF-VERIFY-001',
            'payment_date' => now()->toDateString(),
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reconciliation.outstanding', 35000)
                ->where('reconciliation.verified_payments', 50000)
            );
    }

    public function test_outstanding_accounts_for_negative_adjustments(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 85000,
            'outlet_margin' => 15000,
            'notes' => 'Test sale',
        ]);

        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'adjustment',
            'amount' => -20000,
            'center_share' => 0,
            'outlet_margin' => 0,
            'notes' => 'Return adjustment',
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reconciliation.outstanding', 65000)
                ->where('reconciliation.adjustments', -20000)
            );
    }

    public function test_outstanding_is_zero_when_fully_paid(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 85000,
            'outlet_margin' => 15000,
            'notes' => 'Test sale',
        ]);

        SettlementPayment::create([
            'outlet_id' => $this->context['outlet']->id,
            'amount' => 85000,
            'reference_number' => 'TRF-FULL-001',
            'payment_date' => now()->toDateString(),
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reconciliation.outstanding', 0)
                ->where('reconciliation.verified_payments', 85000)
            );
    }

    public function test_reconciliation_is_single_source_of_truth(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 80000,
            'outlet_margin' => 20000,
            'notes' => 'Test sale',
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                // Hero card uses reconciliation.outstanding
                ->has('reconciliation.outstanding')
                // KPI uses reconciliation.center_share
                ->has('reconciliation.center_share')
                // KPI uses reconciliation.verified_payments
                ->has('reconciliation.verified_payments')
                // All three are present and consistent
                ->where('reconciliation.center_share', 80000)
                ->where('reconciliation.outstanding', 80000)
            );
    }

    public function test_pending_payments_do_not_affect_outstanding(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 85000,
            'outlet_margin' => 15000,
            'notes' => 'Test sale',
        ]);

        SettlementPayment::create([
            'outlet_id' => $this->context['outlet']->id,
            'amount' => 50000,
            'reference_number' => 'TRF-PENDING-001',
            'payment_date' => now()->toDateString(),
            'status' => SettlementPayment::STATUS_PENDING,
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                // Pending payments should NOT reduce outstanding
                ->where('reconciliation.outstanding', 85000)
                ->where('reconciliation.pending_payments', 50000)
            );
    }

    // ─── ADJUSTMENT REDUCES OUTSTANDING ────────────────────────────

    public function test_adjustment_fully_cancels_outstanding(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 85000,
            'outlet_margin' => 15000,
            'notes' => 'Test sale',
        ]);

        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'adjustment',
            'amount' => -85000,
            'center_share' => 0,
            'outlet_margin' => 0,
            'notes' => 'Full return adjustment',
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reconciliation.outstanding', 0)
                ->where('reconciliation.center_share', 85000)
                ->where('reconciliation.adjustments', -85000)
                ->where('reconciliation.verified_payments', 0)
            );
    }

    // ─── HERO CARD REFLECTS OUTSTANDING ────────────────────────────

    public function test_reconciliation_outstanding_is_source_of_truth(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 85000,
            'outlet_margin' => 15000,
            'notes' => 'Test sale',
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reconciliation.outstanding', 85000)
                // KPI "Sudah Disetor" uses reconciliation.verified_payments
                ->where('reconciliation.verified_payments', 0)
                // KPI "Penyesuaian" uses reconciliation.adjustments
                ->where('reconciliation.adjustments', 0)
            );
    }

    // ─── BREAKDOWN MATCHES FORMULA ─────────────────────────────────

    public function test_breakdown_formula_center_share_minus_verified_plus_adjustments(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 200000,
            'center_share' => 160000,
            'outlet_margin' => 40000,
            'notes' => 'Test sale',
        ]);

        SettlementPayment::create([
            'outlet_id' => $this->context['outlet']->id,
            'amount' => 50000,
            'reference_number' => 'TRF-BREAKDOWN-001',
            'payment_date' => now()->toDateString(),
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);

        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'adjustment',
            'amount' => -30000,
            'center_share' => 0,
            'outlet_margin' => 0,
            'notes' => 'Return adjustment',
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                // center_share = 160000
                ->where('reconciliation.center_share', 160000)
                // verified_payments = 50000
                ->where('reconciliation.verified_payments', 50000)
                // adjustments = -30000
                ->where('reconciliation.adjustments', -30000)
                // outstanding = 160000 - 50000 + (-30000) = 80000
                ->where('reconciliation.outstanding', 80000)
            );
    }

    // ─── OUTSTANDING ZERO STATE ────────────────────────────────────

    public function test_outstanding_zero_when_adjustments_cancel_center_share(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 85000,
            'outlet_margin' => 15000,
            'notes' => 'Test sale',
        ]);

        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'adjustment',
            'amount' => -85000,
            'center_share' => 0,
            'outlet_margin' => 0,
            'notes' => 'Full return',
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reconciliation.outstanding', 0)
                ->where('reconciliation.center_share', 85000)
                ->where('reconciliation.adjustments', -85000)
            );
    }

    // ─── GROSS OBLIGATION NOT SHOWN AS CURRENT OBLIGATION ──────────

    public function test_center_share_is_gross_not_current_obligation(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 200000,
            'center_share' => 160000,
            'outlet_margin' => 40000,
            'notes' => 'Test sale',
        ]);

        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'adjustment',
            'amount' => -100000,
            'center_share' => 0,
            'outlet_margin' => 0,
            'notes' => 'Large return',
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                // center_share (gross) = 160000
                ->where('reconciliation.center_share', 160000)
                // adjustments = -100000
                ->where('reconciliation.adjustments', -100000)
                // outstanding (current obligation) = 60000, NOT 160000
                ->where('reconciliation.outstanding', 60000)
            );
    }

    // ─── HELPERS ───────────────────────────────────────────────────

    private function makeOutletContext(): array
    {
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Test Settlement',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Test Settlement',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => uniqid('susu-kambing-settlement-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create(['name' => 'Susu Kambing Settlement', 'brand' => 'Dombi']);
        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Original 500ml',
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'center_stock' => 100,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 1,
        ]);

        return compact('outletUser', 'outlet', 'product', 'variant');
    }
}
