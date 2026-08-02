<?php

namespace Tests\Feature;

use App\Models\CourierInvitation;
use App\Models\CourierProfile;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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
            ->post('/outlet/my-couriers/nominate', [
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

    public function test_duplicate_pending_nomination_is_blocked_for_same_outlet_and_phone(): void
    {
        $this->actingAs($this->outletStaff)
            ->post('/outlet/my-couriers/nominate', [
                'name' => 'Bambang',
                'phone' => '081234567890',
            ]);

        $response = $this->actingAs($this->outletStaff)
            ->post('/outlet/my-couriers/nominate', [
                'name' => 'Bambang',
                'phone' => '081234567890',
            ]);

        $response->assertRedirect();
        $this->assertEquals(1, CourierProfile::where('outlet_id', $this->outlet->id)
            ->where('nominee_phone', '081234567890')
            ->where('invitation_status', 'pending')
            ->count());
    }

    public function test_rejected_nomination_can_be_resubmitted_for_same_phone(): void
    {
        $profile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'nominee_name' => 'Bambang',
            'nominee_phone' => '081234567890',
            'invitation_status' => 'rejected',
            'approved_by' => $this->owner->id,
            'approved_at' => now(),
        ]);

        $this->actingAs($this->outletStaff)
            ->post('/outlet/my-couriers/nominate', [
                'name' => 'Bambang Baru',
                'phone' => '081234567890',
            ])
            ->assertRedirect();

        $profile->refresh();
        $this->assertEquals('pending', $profile->invitation_status);
        $this->assertNull($profile->approved_at);
        $this->assertNull($profile->approved_by);
        $this->assertSame('Bambang Baru', $profile->nominee_name);
        $this->assertEquals(1, CourierProfile::where('outlet_id', $this->outlet->id)
            ->where('nominee_phone', '081234567890')
            ->count());
    }

    public function test_owner_can_approve_nominated_courier(): void
    {
        $profile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'nominee_name' => 'Bambang',
            'nominee_phone' => '081234567890',
            'invitation_status' => 'pending',
        ]);

        $response = $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/approve");

        $response->assertRedirect();
        $profile->refresh();
        $this->assertEquals('pending', $profile->invitation_status);
        $this->assertEquals($this->owner->id, $profile->approved_by);
        $this->assertNotNull($profile->approved_at);
        $this->assertNotNull($profile->user_id);
        $this->assertDatabaseHas('users', ['id' => $profile->user_id, 'role' => 'courier']);
        $this->assertDatabaseHas('courier_invitations', ['courier_user_id' => $profile->user_id, 'status' => 'pending']);
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

    public function test_outlet_nomination_persists_nominee_name_and_phone(): void
    {
        $response = $this->actingAs($this->outletStaff)
            ->post('/outlet/my-couriers/nominate', [
                'name' => '  Bambang Outlet  ',
                'phone' => '0812 3456 7890',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('courier_profiles', [
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'nominee_name' => 'Bambang Outlet',
            'nominee_phone' => '081234567890',
            'invitation_status' => 'pending',
        ]);
    }

    public function test_owner_approval_uses_nominee_identity_in_created_user(): void
    {
        $profile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'nominee_name' => 'Bambang Outlet',
            'nominee_phone' => '081234567890',
            'invitation_status' => 'pending',
        ]);

        $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/approve")
            ->assertRedirect();

        $profile->refresh();
        $createdUser = User::findOrFail($profile->user_id);
        $invitation = CourierInvitation::where('courier_user_id', $createdUser->id)->firstOrFail();

        $this->assertSame('Bambang Outlet', $createdUser->name);
        $this->assertSame('081234567890', $createdUser->phone);
        $this->assertSame('courier', $createdUser->role);
        $this->assertSame('pending', $profile->invitation_status);
        $this->assertSame('Bambang Outlet', $invitation->name);
        $this->assertSame('081234567890', $invitation->phone);
        $this->assertSame('pending', $invitation->status);
    }

    public function test_approved_outlet_nominee_is_not_assignable_until_invitation_acceptance(): void
    {
        $profile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'nominee_name' => 'Bambang Outlet',
            'nominee_phone' => '081234567890',
            'invitation_status' => 'pending',
        ]);

        $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/approve")
            ->assertRedirect();

        $profile->refresh();
        $this->assertNotNull($profile->user_id);
        $this->assertFalse(CourierProfile::availableForOutlet($this->outlet->id)->get()->contains('id', $profile->id));

        $invitation = CourierInvitation::where('courier_user_id', $profile->user_id)->firstOrFail();

        $this->post(route('courier.invite.accept', $invitation->token), [
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect(route('courier.dashboard'));

        $this->assertTrue(CourierProfile::availableForOutlet($this->outlet->id)->get()->contains('id', $profile->id));
    }

    public function test_owner_cannot_reject_already_approved_outlet_nominee(): void
    {
        $profile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'nominee_name' => 'Bambang Outlet',
            'nominee_phone' => '081234567890',
            'invitation_status' => 'pending',
            'approved_at' => now(),
            'user_id' => User::factory()->create(['role' => 'courier'])->id,
        ]);

        $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/reject")
            ->assertRedirect();

        $this->assertDatabaseHas('courier_profiles', [
            'id' => $profile->id,
            'invitation_status' => 'pending',
        ]);
    }

    public function test_owner_cannot_plot_pusat_courier_to_archived_outlet(): void
    {
        $pusatUser = User::factory()->create(['role' => 'courier']);
        $profile = CourierProfile::create([
            'user_id' => $pusatUser->id,
            'courier_source' => 'pusat',
            'invitation_status' => 'accepted',
        ]);
        $archivedOutlet = Outlet::create([
            'name' => 'Archived Plot Outlet',
            'address' => 'Jl. Archive',
            'kelurahan' => 'Archive',
            'kecamatan' => 'Archive',
            'status' => 'archived',
        ]);

        $response = $this->from("/owner/couriers/{$pusatUser->id}")
            ->actingAs($this->owner)
            ->put("/owner/couriers/{$profile->id}/outlets", [
                'outlet_ids' => [$archivedOutlet->id],
            ]);

        $response->assertRedirect("/owner/couriers/{$pusatUser->id}");
        $response->assertSessionHasErrors(['outlet_ids.0']);
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

    public function test_owner_cannot_plot_non_pusat_courier_to_outlets(): void
    {
        $outletUser = User::factory()->create(['role' => 'courier']);
        $profile = CourierProfile::create([
            'user_id' => $outletUser->id,
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'invitation_status' => 'accepted',
        ]);

        $response = $this->actingAs($this->owner)
            ->put("/owner/couriers/{$profile->id}/outlets", [
                'outlet_ids' => [$this->outlet->id],
            ]);

        $response->assertRedirect();
        $this->assertDatabaseMissing('courier_outlet_assignments', [
            'courier_profile_id' => $profile->id,
            'outlet_id' => $this->outlet->id,
        ]);
    }

    public function test_owner_created_courier_has_pusat_source(): void
    {
        $response = $this->actingAs($this->owner)
            ->post('/owner/couriers', [
                'name' => 'Kurir Pusat Baru',
                'phone' => '081234567890',
                'vehicle_type' => 'motorcycle',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('courier_profiles', [
            'courier_source' => 'pusat',
        ]);
    }

    public function test_owner_created_courier_starts_as_pusat_pending_invitation(): void
    {
        $response = $this->actingAs($this->owner)
            ->post('/owner/couriers', [
                'name' => 'Kurir Pusat Pending',
                'phone' => '081234567891',
                'vehicle_type' => 'motorcycle',
            ]);

        $response->assertRedirect();

        $courier = User::where('phone', '081234567891')->firstOrFail();

        $this->assertDatabaseHas('courier_profiles', [
            'user_id' => $courier->id,
            'courier_source' => 'pusat',
            'outlet_id' => null,
            'invitation_status' => 'pending',
        ]);
    }

    public function test_owner_created_courier_becomes_accepted_after_invitation_acceptance(): void
    {
        $this->actingAs($this->owner)
            ->post('/owner/couriers', [
                'name' => 'Kurir Pusat Accepted',
                'phone' => '081234567892',
                'vehicle_type' => 'motorcycle',
            ])
            ->assertRedirect();

        $courier = User::where('phone', '081234567892')->firstOrFail();
        $invitation = CourierInvitation::where('courier_user_id', $courier->id)->firstOrFail();

        $this->post(route('courier.invite.accept', $invitation->token), [
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect(route('courier.dashboard'));

        $profile = CourierProfile::where('user_id', $courier->id)->firstOrFail();
        $invitation->refresh();

        $this->assertSame('accepted', $invitation->status);
        $this->assertNotNull($invitation->accepted_at);
        $this->assertSame('accepted', $profile->invitation_status);
        $this->assertNotNull($profile->accepted_at);
        $this->assertEquals($invitation->accepted_at?->toDateTimeString(), $profile->accepted_at?->toDateTimeString());
        $this->assertSame('pusat', $profile->courier_source);
        $this->assertNull($profile->outlet_id);
        $courier->refresh();
        $this->assertTrue(Hash::check('password123', $courier->password));
        $this->assertFalse((bool) $courier->must_change_password);
    }

    public function test_owner_created_courier_invitation_acceptance_requires_pending_profile(): void
    {
        $this->actingAs($this->owner)
            ->post('/owner/couriers', [
                'name' => 'Kurir Pusat Atomic',
                'phone' => '081234567893',
                'vehicle_type' => 'motorcycle',
            ])
            ->assertRedirect();

        $courier = User::where('phone', '081234567893')->firstOrFail();
        $invitation = CourierInvitation::where('courier_user_id', $courier->id)->firstOrFail();
        $originalPassword = $courier->password;
        CourierProfile::where('user_id', $courier->id)->delete();

        $response = $this->post(route('courier.invite.accept', $invitation->token), [
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(409);

        $invitation->refresh();
        $courier->refresh();

        $this->assertSame('pending', $invitation->status);
        $this->assertNull($invitation->accepted_at);
        $this->assertSame($originalPassword, $courier->password);
    }

    public function test_owner_can_classify_legacy_null_source_profile_as_pusat(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        $profile = CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => null,
            'invitation_status' => 'accepted',
        ]);

        $response = $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/classify", [
                'courier_source' => 'pusat',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('courier_profiles', [
            'id' => $profile->id,
            'courier_source' => 'pusat',
            'outlet_id' => null,
        ]);
    }

    public function test_owner_can_classify_legacy_null_source_profile_as_outlet_owned(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        $profile = CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => null,
            'invitation_status' => 'accepted',
        ]);
        $profile->assignedOutlets()->attach($this->outlet->id);

        $response = $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/classify", [
                'courier_source' => 'outlet',
                'outlet_id' => $this->outlet->id,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('courier_profiles', [
            'id' => $profile->id,
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
        ]);
        $this->assertDatabaseMissing('courier_outlet_assignments', [
            'courier_profile_id' => $profile->id,
            'outlet_id' => $this->outlet->id,
        ]);

        $secondLegacyProfile = CourierProfile::create([
            'user_id' => User::factory()->create(['role' => 'courier'])->id,
            'courier_source' => null,
            'invitation_status' => 'accepted',
        ]);

        $invalidResponse = $this->from("/owner/couriers/{$courier->id}")
            ->actingAs($this->owner)
            ->post("/owner/couriers/{$secondLegacyProfile->id}/classify", [
                'courier_source' => 'outlet',
            ]);

        $invalidResponse->assertRedirect("/owner/couriers/{$courier->id}");
        $invalidResponse->assertSessionHasErrors(['outlet_id']);
    }

    public function test_owner_cannot_classify_legacy_profile_to_archived_outlet(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        $archivedOutlet = Outlet::create([
            'name' => 'Archived Outlet',
            'address' => 'Jl. Archive',
            'kelurahan' => 'Archive',
            'kecamatan' => 'Archive',
            'status' => 'archived',
        ]);
        $profile = CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => null,
            'invitation_status' => 'accepted',
        ]);

        $response = $this->from("/owner/couriers/{$courier->id}")
            ->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/classify", [
                'courier_source' => 'outlet',
                'outlet_id' => $archivedOutlet->id,
            ]);

        $response->assertRedirect("/owner/couriers/{$courier->id}");
        $response->assertSessionHasErrors(['outlet_id']);
    }

    public function test_owner_cannot_plot_legacy_null_source_profile_before_classification(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        $profile = CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => null,
            'invitation_status' => 'accepted',
        ]);

        $response = $this->from("/owner/couriers/{$courier->id}")
            ->actingAs($this->owner)
            ->put("/owner/couriers/{$profile->id}/outlets", [
                'outlet_ids' => [$this->outlet->id],
            ]);

        $response->assertRedirect("/owner/couriers/{$courier->id}");
        $response->assertSessionHas('error');
        $this->assertDatabaseMissing('courier_outlet_assignments', [
            'courier_profile_id' => $profile->id,
            'outlet_id' => $this->outlet->id,
        ]);
    }

    public function test_owner_cannot_reclassify_non_legacy_profile(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        $profile = CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'pusat',
            'invitation_status' => 'accepted',
        ]);

        $response = $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/classify", [
                'courier_source' => 'outlet',
                'outlet_id' => $this->outlet->id,
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('courier_profiles', [
            'id' => $profile->id,
            'courier_source' => 'pusat',
            'outlet_id' => null,
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
