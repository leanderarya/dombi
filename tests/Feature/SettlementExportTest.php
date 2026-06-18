<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettlementExportTest extends TestCase
{
    use RefreshDatabase;

    private array $context;

    protected function setUp(): void
    {
        parent::setUp();

        $this->context = $this->makeOwnerContext();
    }

    // ─── ROUTE ACCESS ──────────────────────────────────────────────

    public function test_owner_can_export_settlements_csv(): void
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
            ->get('/owner/finance/settlements/export')
            ->assertOk()
            ->assertHeaderContains('Content-Type', 'text/csv')
            ->assertHeaderContains('Content-Disposition', 'attachment; filename="settlements-');
    }

    public function test_export_requires_owner_role(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $this->actingAs($outletUser)
            ->get('/owner/finance/settlements/export')
            ->assertRedirect();
    }

    // ─── CSV CONTENT ──────────────────────────────────────────────

    public function test_export_csv_contains_all_columns(): void
    {
        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->subDays(3)->toDateString(),
            'sales_amount' => 200000,
            'amount_due' => 160000,
            'due_date' => now()->addDays(4)->toDateString(),
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->context['owner'])
            ->get('/owner/finance/settlements/export')
            ->assertOk();

        ob_start();
        $response->sendContent();
        $csv = ob_get_clean();

        $this->assertStringContainsString('Outlet', $csv);
        $this->assertStringContainsString('Periode', $csv);
        $this->assertStringContainsString('Jatuh Tempo', $csv);
        $this->assertStringContainsString('Total Tagihan', $csv);
        $this->assertStringContainsString('Sudah Dibayar', $csv);
        $this->assertStringContainsString('Sisa', $csv);
        $this->assertStringContainsString('Status', $csv);
    }

    public function test_export_csv_contains_multiple_settlements(): void
    {
        $outlet2User = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outlet2 = Outlet::create([
            'user_id' => $outlet2User->id,
            'name' => 'Outlet Kedua',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test 2',
            'status' => 'active',
        ]);

        Settlement::create([
            'outlet_id' => $this->context['outlet']->id,
            'period_date' => now()->subDays(3)->toDateString(),
            'sales_amount' => 200000,
            'amount_due' => 160000,
            'due_date' => now()->addDays(4)->toDateString(),
            'status' => 'pending',
        ]);

        Settlement::create([
            'outlet_id' => $outlet2->id,
            'period_date' => now()->subDays(5)->toDateString(),
            'sales_amount' => 100000,
            'amount_due' => 80000,
            'paid_amount' => 80000,
            'due_date' => now()->subDays(1)->toDateString(),
            'status' => 'paid',
        ]);

        $response = $this->actingAs($this->context['owner'])
            ->get('/owner/finance/settlements/export')
            ->assertOk();

        ob_start();
        $response->sendContent();
        $csv = ob_get_clean();

        $this->assertStringContainsString($this->context['outlet']->name, $csv);
        $this->assertStringContainsString('Outlet Kedua', $csv);
        $this->assertStringContainsString('160000', $csv);
        $this->assertStringContainsString('80000', $csv);
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
