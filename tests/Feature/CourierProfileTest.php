<?php

namespace Tests\Feature;

use App\Models\CourierProfile;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierProfileTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $outletStaff;
    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
        $this->outlet = Outlet::create([
            'name' => 'Test Outlet',
            'address' => 'Jl. Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'status' => 'active',
        ]);

        $this->outletStaff = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $this->outlet->id,
        ]);
    }

    public function test_outlet_can_nominate_courier(): void
    {
        $response = $this->actingAs($this->outletStaff)
            ->post("/outlet/my-couriers/nominate", [
                'name' => 'Bambang',
                'phone' => '081234567890',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('courier_profiles', [
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'invitation_status' => 'pending',
        ]);
    }

    public function test_owner_can_approve_nominated_courier(): void
    {
        $profile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'invitation_status' => 'pending',
        ]);

        $response = $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/approve");

        $response->assertRedirect();
        $profile->refresh();
        $this->assertEquals('accepted', $profile->invitation_status);
        $this->assertEquals($this->owner->id, $profile->approved_by);
        $this->assertNotNull($profile->approved_at);
        $this->assertNotNull($profile->user_id);
        $this->assertDatabaseHas('users', ['id' => $profile->user_id, 'role' => 'courier']);
    }

    public function test_owner_can_reject_nominated_courier_with_audit_trail(): void
    {
        $profile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'invitation_status' => 'pending',
        ]);

        $response = $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/reject");

        $response->assertRedirect();
        $profile->refresh();
        $this->assertEquals('rejected', $profile->invitation_status);
        $this->assertEquals($this->owner->id, $profile->approved_by);
        $this->assertDatabaseHas('courier_profiles', ['id' => $profile->id]);
    }

    public function test_owner_can_plot_pusat_courier_to_outlets(): void
    {
        $pusatUser = User::factory()->create(['role' => 'courier']);
        $profile = CourierProfile::create([
            'user_id' => $pusatUser->id,
            'courier_source' => 'pusat',
            'invitation_status' => 'accepted',
        ]);

        $outletB = Outlet::create([
            'name' => 'Outlet B',
            'address' => 'Jl. B',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->owner)
            ->put("/owner/couriers/{$profile->id}/outlets", [
                'outlet_ids' => [$this->outlet->id, $outletB->id],
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('courier_outlet_assignments', [
            'courier_profile_id' => $profile->id,
            'outlet_id' => $this->outlet->id,
        ]);
        $this->assertDatabaseHas('courier_outlet_assignments', [
            'courier_profile_id' => $profile->id,
            'outlet_id' => $outletB->id,
        ]);
    }

    public function test_scope_available_for_outlet_returns_assigned_pusat_and_owned_outlet(): void
    {
        $pusatUser = User::factory()->create(['role' => 'courier']);
        $pusatProfile = CourierProfile::create([
            'user_id' => $pusatUser->id,
            'courier_source' => 'pusat',
            'invitation_status' => 'accepted',
        ]);
        $pusatProfile->assignedOutlets()->attach($this->outlet->id);

        $outletProfile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'invitation_status' => 'accepted',
        ]);

        $available = CourierProfile::availableForOutlet($this->outlet->id)->get();

        $this->assertCount(2, $available);
        $this->assertTrue($available->contains('id', $pusatProfile->id));
        $this->assertTrue($available->contains('id', $outletProfile->id));
    }
}