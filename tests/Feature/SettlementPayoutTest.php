<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettlementPayoutTest extends TestCase
{
    use RefreshDatabase;

    private Outlet $outlet;

    private User $outletUser;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->outlet = Outlet::create([
            'name' => 'Outlet Payout',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Test',
            'latitude' => -7.07,
            'longitude' => 110.42,
            'status' => 'active',
        ]);
        $this->outletUser = User::factory()->create(['role' => 'outlet', 'outlet_id' => $this->outlet->id, 'is_active' => true]);
        $this->owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
    }

    private function makeSettlement(string $direction, float $net, float $amountDue, ?string $periodDate = null): Settlement
    {
        $periodDate = $periodDate ?? now()->toDateString();

        return Settlement::create([
            'outlet_id' => $this->outlet->id,
            'period_type' => 'weekly',
            'period_date' => $periodDate,
            'period_start' => Carbon::parse($periodDate)->subDays(6)->toDateString(),
            'period_end' => $periodDate,
            'sales_amount' => 100000,
            'amount_due' => $amountDue,
            'net_amount' => $net,
            'direction' => $direction,
            'due_date' => Carbon::parse($periodDate)->addDays(7)->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
            'adjustment_amount' => 0,
        ]);
    }

    public function test_owner_records_payout_allocates_to_owner_pays_settlement(): void
    {
        $s = $this->makeSettlement(Settlement::DIRECTION_OWNER_PAYS, 50000, 50000);

        $this->actingAs($this->owner)
            ->post("/owner/finance/settlements/{$this->outlet->id}/payout", [
                'amount' => 50000,
                'reference_number' => 'PO-TEST-001',
            ])
            ->assertSessionHasNoErrors();

        $s->refresh();
        $this->assertSame(50000.0, (float) $s->paid_amount);
        $this->assertSame(Settlement::STATUS_PAID, $s->status);
        $this->assertSame(0.0, (float) $s->outstanding_amount);
    }

    public function test_outlet_payment_does_not_allocate_across_direction(): void
    {
        $ownerPays = $this->makeSettlement(Settlement::DIRECTION_OWNER_PAYS, 50000, 50000, '2026-08-03');
        $outletPays = $this->makeSettlement(Settlement::DIRECTION_OUTLET_PAYS, -30000, 30000, '2026-08-10');

        // Owner records an outlet→owner payment (remittance)
        $this->actingAs($this->owner)
            ->post("/owner/finance/settlements/{$this->outlet->id}/payments", [
                'amount' => 30000,
                'payment_method' => 'transfer_bank',
            ])
            ->assertSessionHasNoErrors();

        $outletPays->refresh();
        $ownerPays->refresh();
        $this->assertSame(30000.0, (float) $outletPays->paid_amount);
        $this->assertSame(0.0, (float) $ownerPays->paid_amount);
    }

    public function test_owner_payout_does_not_touch_outlet_pays_settlement(): void
    {
        $ownerPays = $this->makeSettlement(Settlement::DIRECTION_OWNER_PAYS, 50000, 50000, '2026-08-03');
        $outletPays = $this->makeSettlement(Settlement::DIRECTION_OUTLET_PAYS, -30000, 30000, '2026-08-10');

        $this->actingAs($this->owner)
            ->post("/owner/finance/settlements/{$this->outlet->id}/payout", [
                'amount' => 50000,
            ])
            ->assertSessionHasNoErrors();

        $outletPays->refresh();
        $ownerPays->refresh();
        $this->assertSame(50000.0, (float) $ownerPays->paid_amount);
        $this->assertSame(0.0, (float) $outletPays->paid_amount);
    }

    public function test_fifo_orders_within_same_direction(): void
    {
        $older = Settlement::create([
            'outlet_id' => $this->outlet->id,
            'period_type' => 'weekly',
            'period_date' => '2026-07-01',
            'period_start' => '2026-06-29',
            'period_end' => '2026-07-05',
            'sales_amount' => 100000,
            'amount_due' => 30000,
            'net_amount' => 30000,
            'direction' => Settlement::DIRECTION_OWNER_PAYS,
            'due_date' => '2026-07-12',
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
            'adjustment_amount' => 0,
        ]);
        $newer = $this->makeSettlement(Settlement::DIRECTION_OWNER_PAYS, 20000, 20000);

        // Payout 40k — harusnya older (30k) lunas dulu, sisanya 10k ke newer
        $this->actingAs($this->owner)
            ->post("/owner/finance/settlements/{$this->outlet->id}/payout", [
                'amount' => 40000,
            ])
            ->assertSessionHasNoErrors();

        $older->refresh();
        $newer->refresh();
        $this->assertSame(30000.0, (float) $older->paid_amount);
        $this->assertSame(10000.0, (float) $newer->paid_amount);
    }

    public function test_payout_requires_owner_role(): void
    {
        $this->makeSettlement(Settlement::DIRECTION_OWNER_PAYS, 50000, 50000);

        $this->actingAs($this->outletUser)
            ->post("/owner/finance/settlements/{$this->outlet->id}/payout", [
                'amount' => 10000,
            ])
            ->assertRedirect();
    }

    public function test_payout_rejected_when_no_owner_pays_settlement(): void
    {
        $this->makeSettlement(Settlement::DIRECTION_OUTLET_PAYS, -30000, 30000);

        $this->actingAs($this->owner)
            ->post("/owner/finance/settlements/{$this->outlet->id}/payout", [
                'amount' => 10000,
            ])
            ->assertSessionHas('error');
    }

    public function test_existing_payments_default_to_outlet_direction(): void
    {
        $p = SettlementPayment::create([
            'outlet_id' => $this->outlet->id,
            'reference_number' => 'LEGACY-001',
            'payment_date' => now()->toDateString(),
            'amount' => 1000,
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);

        $this->assertSame(Settlement::DIRECTION_OUTLET_PAYS, $p->direction);
        $this->assertTrue($p->isRemittance());
        $this->assertFalse($p->isPayout());
    }
}
