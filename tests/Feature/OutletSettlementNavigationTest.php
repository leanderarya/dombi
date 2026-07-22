<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\Settlement;
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

    // ─── SETTLEMENT PAGE DATA ──────────────────────────────────────

    public function test_settlement_page_shows_outstanding(): void
    {
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 200000,
            'amount_due' => 200000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
            'adjustment_amount' => 0,
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
        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk();
    }

    public function test_settlement_payment_routes_exist(): void
    {
        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement-payments')
            ->assertOk();

        $this->actingAs($this->context['outletUser'])
            ->post('/outlet/settlement-payments', [
                'amount' => 10000,
                'reference_number' => 'TRF-ROUTE-TEST',
                'payment_date' => now()->toDateString(),
            ])
            ->assertRedirect();
    }

    // ─── OUTSTANDING CALCULATION (from settlements table) ──────────

    public function test_outstanding_equals_amount_due_when_no_payments(): void
    {
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 100000,
            'amount_due' => 85000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
            'adjustment_amount' => 0,
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
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 100000,
            'amount_due' => 85000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_PARTIAL,
            'paid_amount' => 50000,
            'adjustment_amount' => 0,
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

    public function test_outstanding_accounts_for_adjustments(): void
    {
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 100000,
            'amount_due' => 85000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_PARTIAL,
            'paid_amount' => 0,
            'adjustment_amount' => 20000,
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reconciliation.outstanding', 65000)
                ->where('reconciliation.adjustments', 20000)
            );
    }

    public function test_outstanding_is_zero_when_fully_paid(): void
    {
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 100000,
            'amount_due' => 85000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_PAID,
            'paid_amount' => 85000,
            'adjustment_amount' => 0,
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

    public function test_pending_payments_do_not_affect_outstanding(): void
    {
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 100000,
            'amount_due' => 85000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
            'adjustment_amount' => 0,
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
                ->where('reconciliation.outstanding', 85000)
                ->where('reconciliation.pending_payments', 50000)
            );
    }

    public function test_adjustment_fully_cancels_outstanding(): void
    {
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->toDateString(),
            'period_start' => now()->subDays(7)->toDateString(),
            'period_end' => now()->addDays(7)->toDateString(),
            'sales_amount' => 100000,
            'amount_due' => 85000,
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_PAID,
            'paid_amount' => 0,
            'adjustment_amount' => 85000,
        ]);

        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reconciliation.outstanding', 0)
                ->where('reconciliation.center_share', 85000)
                ->where('reconciliation.adjustments', 85000)
                ->where('reconciliation.verified_payments', 0)
            );
    }

    public function test_outstanding_matches_owner_calculation(): void
    {
        // Create settlement - same data owner would see
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->subDays(10)->toDateString(),
            'period_start' => now()->subDays(17)->toDateString(),
            'period_end' => now()->subDays(3)->toDateString(),
            'sales_amount' => 100000,
            'amount_due' => 85000,
            'due_date' => now()->subDays(3)->toDateString(),
            'status' => Settlement::STATUS_OVERDUE,
            'paid_amount' => 0,
            'adjustment_amount' => 0,
        ]);

        // Owner sees 85000 outstanding - outlet should too
        $this->actingAs($this->context['outletUser'])
            ->get('/outlet/settlement')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reconciliation.outstanding', 85000)
                ->where('reconciliation.center_share', 85000)
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
        $outletUser->update(['outlet_id' => $outlet->id]);

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
