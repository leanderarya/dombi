<?php

namespace Tests\Feature;

use App\Models\CourierInvitation;
use App\Models\CourierProfile;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MyCourierBucketsTest extends TestCase
{
    use RefreshDatabase;

    private User $outletStaff;

    private Outlet $outlet;

    private Outlet $otherOutlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->outlet = Outlet::create(['name' => 'Test Outlet', 'address' => 'Jl. Test', 'kelurahan' => 'Test', 'kecamatan' => 'Test', 'status' => 'active']);
        $this->otherOutlet = Outlet::create(['name' => 'Other Outlet', 'address' => 'Jl. Lain', 'kelurahan' => 'Lain', 'kecamatan' => 'Lain', 'status' => 'active']);
        $this->outletStaff = User::factory()->create(['role' => 'outlet', 'outlet_id' => $this->outlet->id]);
    }

    private function profile(array $overrides = []): CourierProfile
    {
        return CourierProfile::create(array_merge([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'invitation_status' => CourierProfile::STATUS_ACTIVE,
        ], $overrides));
    }

    public function test_index_returns_active_submitted_awaiting_rejected_buckets(): void
    {
        $activeUser = User::factory()->create(['role' => 'courier']);
        $this->profile(['user_id' => $activeUser->id]);
        $this->profile(['nominee_name' => 'Pending', 'nominee_phone' => '081200000001', 'invitation_status' => CourierProfile::STATUS_SUBMITTED]);
        $this->profile(['nominee_name' => 'Awaiting', 'nominee_phone' => '081200000003', 'invitation_status' => CourierProfile::STATUS_AWAITING_ACTIVATION]);
        $this->profile(['nominee_name' => 'Rejected', 'nominee_phone' => '081200000002', 'invitation_status' => CourierProfile::STATUS_REJECTED, 'approved_by' => User::factory()->create(['role' => 'owner'])->id, 'approved_at' => now()]);

        $response = $this->actingAs($this->outletStaff)->get('/outlet/my-couriers');

        $response->assertInertia(fn ($page) => $page
            ->component('outlet/my-couriers/index')
            ->has('active', 1)
            ->where('active.0.id', $activeUser->courierProfile->id)
            ->has('submitted', 1)
            ->where('submitted.0.nominee_name', 'Pending')
            ->has('awaiting', 1)
            ->where('awaiting.0.nominee_name', 'Awaiting')
            ->has('rejected', 1)
            ->where('rejected.0.nominee_name', 'Rejected')
        );
    }

    public function test_active_includes_plotted_pusat_courier(): void
    {
        $pusatUser = User::factory()->create(['role' => 'courier']);
        $pusatProfile = CourierProfile::create(['user_id' => $pusatUser->id, 'courier_source' => 'pusat', 'invitation_status' => CourierProfile::STATUS_ACTIVE]);
        $pusatProfile->assignedOutlets()->attach($this->outlet->id);

        $response = $this->actingAs($this->outletStaff)->get('/outlet/my-couriers');

        $response->assertInertia(fn ($page) => $page->has('active', 1));
    }

    public function test_active_excludes_other_outlet_courier(): void
    {
        $otherUser = User::factory()->create(['role' => 'courier']);
        CourierProfile::create(['user_id' => $otherUser->id, 'courier_source' => 'outlet', 'outlet_id' => $this->otherOutlet->id, 'invitation_status' => CourierProfile::STATUS_ACTIVE]);

        $response = $this->actingAs($this->outletStaff)->get('/outlet/my-couriers');

        $response->assertInertia(fn ($page) => $page->has('active', 0));
    }

    public function test_awaiting_bucket_includes_invite_url_when_pending_invitation_exists(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $nominee = User::factory()->create(['role' => 'courier']);
        $this->profile([
            'nominee_name' => 'Awaiting Link',
            'nominee_phone' => '081200000004',
            'invitation_status' => CourierProfile::STATUS_AWAITING_ACTIVATION,
            'user_id' => $nominee->id,
            'approved_by' => $owner->id,
            'approved_at' => now(),
        ]);

        $invitation = CourierInvitation::create([
            'invited_by' => $owner->id,
            'courier_user_id' => $nominee->id,
            'phone' => '081200000004',
            'name' => 'Awaiting Link',
            'token' => CourierInvitation::generateToken(),
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
        ]);

        $response = $this->actingAs($this->outletStaff)->get('/outlet/my-couriers');

        $response->assertInertia(fn ($page) => $page
            ->where('awaiting.0.invite_url', url('/courier/invite/'.$invitation->token)));
    }

    public function test_outlet_can_regenerate_expired_invitation_link(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $nominee = User::factory()->create(['role' => 'courier']);
        $profile = $this->profile([
            'nominee_name' => 'Awaiting Expired',
            'nominee_phone' => '081200000005',
            'invitation_status' => CourierProfile::STATUS_AWAITING_ACTIVATION,
            'user_id' => $nominee->id,
            'approved_by' => $owner->id,
            'approved_at' => now(),
        ]);

        $old = CourierInvitation::create([
            'invited_by' => $owner->id,
            'courier_user_id' => $nominee->id,
            'phone' => '081200000005',
            'name' => 'Awaiting Expired',
            'token' => CourierInvitation::generateToken(),
            'status' => 'pending',
            'expires_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($this->outletStaff)
            ->post("/outlet/my-couriers/{$profile->id}/invitation/regenerate")
            ->assertRedirect();

        $old->refresh();
        $this->assertSame('expired', $old->status);

        $fresh = CourierInvitation::where('courier_user_id', $nominee->id)
            ->where('status', 'pending')
            ->firstOrFail();

        $this->assertNotSame($old->token, $fresh->token);
        $this->assertTrue($fresh->expires_at->isFuture());
    }

    public function test_outlet_cannot_regenerate_invitation_for_foreign_outlet_profile(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $nominee = User::factory()->create(['role' => 'courier']);
        $foreign = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->otherOutlet->id,
            'nominee_name' => 'Lain',
            'nominee_phone' => '081200000006',
            'invitation_status' => CourierProfile::STATUS_AWAITING_ACTIVATION,
            'user_id' => $nominee->id,
            'approved_by' => $owner->id,
            'approved_at' => now(),
        ]);

        $this->actingAs($this->outletStaff)
            ->post("/outlet/my-couriers/{$foreign->id}/invitation/regenerate")
            ->assertStatus(403);
    }
}
