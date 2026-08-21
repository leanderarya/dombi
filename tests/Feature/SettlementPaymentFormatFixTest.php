<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettlementPaymentFormatFixTest extends TestCase
{
    use RefreshDatabase;

    public function test_settlement_payment_accepts_large_amount(): void
    {
        $user = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user->update(['outlet_id' => $outlet->id]);

        Settlement::factory()->create([
            'outlet_id' => $outlet->id,
            'amount_due' => 500000,
            'paid_amount' => 0,
            'status' => Settlement::STATUS_GENERATED,
            'period_type' => 'weekly',
            'period_start' => now()->subWeek()->toDateString(),
            'period_end' => now()->toDateString(),
        ]);

        $response = $this->actingAs($user)->post('/outlet/settlement-payments', [
            'amount' => 323000,
            'reference_number' => 'TRF-'.uniqid(),
            'payment_date' => now()->toDateString(),
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('settlement_payments', [
            'outlet_id' => $outlet->id,
            'amount' => 323000,
        ]);
    }
}
