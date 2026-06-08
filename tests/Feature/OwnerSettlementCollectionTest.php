<?php

namespace Tests\Feature;

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

class OwnerSettlementCollectionTest extends TestCase
{
    use RefreshDatabase;

    private array $context;

    protected function setUp(): void
    {
        parent::setUp();

        $this->context = $this->makeOwnerContext();
    }

    // ─── ROUTE ACCESS ──────────────────────────────────────────────

    public function test_owner_can_access_collection_page(): void
    {
        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/collection')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/settlement-collection')
                ->has('collection.hero')
                ->has('collection.verification_queue')
                ->has('collection.priority_list')
                ->has('collection.aging')
                ->has('collection.rankings')
            );
    }

    public function test_collection_page_requires_owner_role(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $this->actingAs($outletUser)
            ->get('/owner/settlement/collection')
            ->assertRedirect();
    }

    // ─── HERO DATA ─────────────────────────────────────────────────

    public function test_hero_reflects_outstanding_from_reconciliation(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 200000,
            'center_share' => 160000,
            'outlet_margin' => 40000,
            'notes' => 'Test sale',
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/collection')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                // The outlet's outstanding should be 160000
                ->where('collection.priority_list.0.outstanding', 160000)
                ->where('collection.priority_list.0.center_share', 160000)
                ->where('collection.hero.outlets_overdue', 1)
            );
    }

    public function test_hero_shows_collected_after_verified_payment(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 200000,
            'center_share' => 160000,
            'outlet_margin' => 40000,
        ]);

        SettlementPayment::create([
            'outlet_id' => $this->context['outlet']->id,
            'amount' => 50000,
            'reference_number' => 'TRF-COL-001',
            'payment_date' => now()->toDateString(),
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/collection')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('collection.priority_list.0.outstanding', 110000)
                ->where('collection.hero.total_collected', 50000)
            );
    }

    // ─── VERIFICATION QUEUE ────────────────────────────────────────

    public function test_verification_queue_shows_pending_payments(): void
    {
        $payment = SettlementPayment::create([
            'outlet_id' => $this->context['outlet']->id,
            'amount' => 75000,
            'reference_number' => 'TRF-VERIF-001',
            'payment_date' => now()->toDateString(),
            'status' => SettlementPayment::STATUS_PENDING,
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/collection')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('collection.verification_queue', 1)
                ->where('collection.verification_queue.0.outlet.name', $this->context['outlet']->name)
            );
    }

    public function test_verification_queue_excludes_verified_payments(): void
    {
        SettlementPayment::create([
            'outlet_id' => $this->context['outlet']->id,
            'amount' => 50000,
            'reference_number' => 'TRF-VERIF-EXCL',
            'payment_date' => now()->toDateString(),
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/collection')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('collection.verification_queue', [])
            );
    }

    // ─── PRIORITY LIST ─────────────────────────────────────────────

    public function test_priority_list_sorted_by_outstanding_desc(): void
    {
        // Create second outlet
        $outlet2User = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outlet2 = Outlet::create([
            'user_id' => $outlet2User->id,
            'name' => 'Outlet B',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Test B',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ]);

        // Outlet A: outstanding 100k
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 150000,
            'center_share' => 100000,
            'outlet_margin' => 50000,
        ]);

        // Outlet B: outstanding 200k
        OutletPayable::create([
            'outlet_id' => $outlet2->id,
            'type' => 'sale',
            'amount' => 300000,
            'center_share' => 200000,
            'outlet_margin' => 100000,
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/collection')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                // First item should be Outlet B (200k), second should be Outlet A (100k)
                ->where('collection.priority_list.0.outstanding', 200000)
                ->where('collection.priority_list.1.outstanding', 100000)
            );
    }

    public function test_fully_paid_outlet_not_in_priority_list(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 80000,
            'outlet_margin' => 20000,
        ]);

        SettlementPayment::create([
            'outlet_id' => $this->context['outlet']->id,
            'amount' => 80000,
            'reference_number' => 'TRF-FULL-001',
            'payment_date' => now()->toDateString(),
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/collection')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                // Fully paid outlet should not appear in priority list
                ->where('collection.priority_list', [])
                ->where('collection.hero.outlets_overdue', 0)
            );
    }

    // ─── AGING BUCKETS ─────────────────────────────────────────────

    public function test_aging_buckets_categorize_outlets(): void
    {
        // Create an old payable (simulating 40 days overdue)
        $payable = OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 200000,
            'center_share' => 160000,
            'outlet_margin' => 40000,
        ]);
        // Backdate the created_at
        \DB::table('outlet_payables')
            ->where('id', $payable->id)
            ->update(['created_at' => now()->subDays(40)]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/collection')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                // >30 Hari bucket should have 1 outlet
                ->where('collection.aging.3.count', 1)
                ->where('collection.aging.3.amount', 160000)
            );
    }

    // ─── RANKINGS ──────────────────────────────────────────────────

    public function test_rankings_by_revenue_sorted_desc(): void
    {
        $outlet2User = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outlet2 = Outlet::create([
            'user_id' => $outlet2User->id,
            'name' => 'Outlet Revenue B',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Test Revenue',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ]);

        // Outlet A: center_share 100k
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 150000,
            'center_share' => 100000,
            'outlet_margin' => 50000,
        ]);

        // Outlet B: center_share 200k
        OutletPayable::create([
            'outlet_id' => $outlet2->id,
            'type' => 'sale',
            'amount' => 300000,
            'center_share' => 200000,
            'outlet_margin' => 100000,
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/collection')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('collection.rankings.by_revenue.0.center_share', 200000)
                ->where('collection.rankings.by_revenue.1.center_share', 100000)
            );
    }

    // ─── OUTLET DETAIL ─────────────────────────────────────────────

    public function test_outlet_detail_shows_reconciliation(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 200000,
            'center_share' => 160000,
            'outlet_margin' => 40000,
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/outlet/' . $this->context['outlet']->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('reconciliation')
                ->where('reconciliation.outstanding', 160000)
                ->where('reconciliation.center_share', 160000)
            );
    }

    public function test_outlet_detail_shows_timeline(): void
    {
        OutletPayable::create([
            'outlet_id' => $this->context['outlet']->id,
            'type' => 'sale',
            'amount' => 100000,
            'center_share' => 80000,
            'outlet_margin' => 20000,
            'notes' => 'Test sale',
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/settlement/outlet/' . $this->context['outlet']->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('timeline')
                ->has('outletName')
                ->has('reconciliation')
            );
    }

    // ─── HELPERS ───────────────────────────────────────────────────

    private function makeOwnerContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);

        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Test Collection',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Test Collection',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => uniqid('susu-kambing-collection-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create(['name' => 'Susu Kambing Collection', 'brand' => 'Dombi']);
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

        return compact('owner', 'outletUser', 'outlet', 'product', 'variant');
    }
}
