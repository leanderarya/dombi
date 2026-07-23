<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OutletPasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_reset_active_outlet_password(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $outletUser = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
            'email' => 'outlet-test@dombi.local',
            'is_active' => true,
            'must_change_password' => false,
            'remember_token' => 'oldtoken123',
        ]);
        $outlet->update(['user_id' => $outletUser->id]);
        $oldToken = $outletUser->remember_token;
        $oldActive = $outletUser->is_active;

        $response = $this->actingAs($owner)
            ->post(route('owner.outlets.reset-password', $outlet));

        $response->assertRedirect();
        $response->assertSessionHas('outlet_provisioning');
        $flash = session('outlet_provisioning');
        $this->assertMatchesRegularExpression('/^DMB-[A-Z0-9]{8}$/', $flash['temporary_password']);

        $outletUser->refresh();
        $this->assertTrue($outletUser->must_change_password);
        $this->assertNotEquals($oldToken, $outletUser->remember_token);
        $this->assertEquals($oldActive, $outletUser->is_active);
        $this->assertNotNull($outletUser->remember_token);
    }

    public function test_archived_outlet_cannot_be_reset(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $outlet = Outlet::factory()->create(['status' => 'archived']);
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);
        $outlet->update(['user_id' => $user->id]);

        $this->actingAs($owner)
            ->post(route('owner.outlets.reset-password', $outlet))
            ->assertSessionHasErrors(['outlet']);
    }

    public function test_owner_cannot_reset_outlet_without_user_account(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $outlet = Outlet::factory()->create(['status' => 'active']);

        $response = $this->actingAs($owner)
            ->post(route('owner.outlets.reset-password', $outlet));

        $response->assertRedirect();
        $response->assertSessionHasErrors('user');
    }

    public function test_non_owner_cannot_reset(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create(['status' => 'active', 'user_id' => $outletUser->id]);
        $outlet->update(['user_id' => $outletUser->id]);

        $this->actingAs($outletUser)
            ->post(route('owner.outlets.reset-password', $outlet))
            ->assertRedirect();
    }

    public function test_guest_cannot_reset_outlet_password(): void
    {
        $outlet = Outlet::factory()->create(['status' => 'active']);

        $response = $this->post(route('owner.outlets.reset-password', $outlet));

        $response->assertRedirect(route('login'));
    }

    public function test_old_password_invalid_after_reset(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
            'password' => Hash::make('old-password-123'),
        ]);
        $outlet->update(['user_id' => $user->id]);

        $this->actingAs($owner)->post(route('owner.outlets.reset-password', $outlet));

        $this->assertFalse(Hash::check('old-password-123', $user->fresh()->password));
    }

    public function test_audit_log_created_on_reset(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);
        $outlet->update(['user_id' => $user->id]);

        $this->actingAs($owner)->post(route('owner.outlets.reset-password', $outlet));

        $this->assertDatabaseHas('outlet_audit_logs', [
            'outlet_id' => $outlet->id,
            'field' => 'password',
        ]);
    }
}
