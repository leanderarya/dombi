<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Settlement;
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
            ->get('/owner/finance')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/finance/index')
                ->has('kpis')
                ->has('outlets')
            );
    }

    public function test_collection_page_requires_owner_role(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $this->actingAs($outletUser)
            ->get('/owner/finance')
            ->assertRedirect();
    }

    // ─── KPI DATA ──────────────────────────────────────────────────

    public function test_kpis_reflect_outstanding_settlements(): void
    {
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->subDays(3)->toDateString(),
            'sales_amount' => 200000,
            'amount_due' => 160000,
            'due_date' => now()->addDays(4)->toDateString(),
            'status' => 'pending',
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/finance')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('kpis.total_unpaid', 160000)
                ->where('kpis.outlets_unpaid', 1)
            );
    }

    public function test_kpis_reflect_paid_settlements(): void
    {
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->subDays(10)->toDateString(),
            'sales_amount' => 200000,
            'amount_due' => 160000,
            'due_date' => now()->subDays(3)->toDateString(),
            'status' => 'paid',
            'paid_amount' => 160000,
            'paid_at' => now()->subDays(2),
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/finance')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('kpis.total_unpaid', 0)
                ->where('kpis.outlets_unpaid', 0)
            );
    }

    // ─── OUTLET TABLE ─────────────────────────────────────────────

    public function test_dashboard_shows_outlets_with_unpaid(): void
    {
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->subDays(3)->toDateString(),
            'sales_amount' => 200000,
            'amount_due' => 160000,
            'due_date' => now()->addDays(4)->toDateString(),
            'status' => 'pending',
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/finance')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('outlets', 1)
                ->where('outlets.0.outlet_name', $this->context['outlet']->name)
                ->where('outlets.0.total_outstanding', 160000)
            );
    }

    public function test_overdue_outlets_sorted_first(): void
    {
        // Create an overdue settlement
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->subDays(14)->toDateString(),
            'sales_amount' => 200000,
            'amount_due' => 160000,
            'due_date' => now()->subDays(7)->toDateString(),
            'status' => 'overdue',
        ]);

        $this->actingAs($this->context['owner'])
            ->get('/owner/finance')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('outlets.0.display_status', 'overdue')
            );
    }

    // ─── HELPERS ───────────────────────────────────────────────────

    private function makeOwnerContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'status' => 'active',
        ]);
        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();

        return compact('owner', 'outletUser', 'outlet');
    }
}
