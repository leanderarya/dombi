<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\PaymentAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_outlet_can_view_active_accounts(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Test Outlet',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'status' => 'active',
        ]);
        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();

        PaymentAccount::create(['bank_name' => 'BCA', 'account_number' => '123', 'account_holder' => 'Test', 'is_active' => true]);
        PaymentAccount::create(['bank_name' => 'Mandiri', 'account_number' => '456', 'account_holder' => 'Test', 'is_active' => false]);

        $response = $this->actingAs($outletUser)->get('/outlet/settlement');

        $response->assertStatus(200);
    }
}
