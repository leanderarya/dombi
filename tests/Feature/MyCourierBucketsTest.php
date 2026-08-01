<?php

namespace Tests\Feature;

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
            'invitation_status' => 'accepted',
        ], $overrides));
    }

    public function test_index_returns_active_pending_rejected_buckets(): void
    {
        $activeUser = User::factory()->create(['role' => 'courier']);
        $this->profile(['user_id' => $activeUser->id]);
        $this->profile(['nominee_name' => 'Pending', 'nominee_phone' => '081200000001', 'invitation_status' => 'pending']);
        $this->profile(['nominee_name' => 'Rejected', 'nominee_phone' => '081200000002', 'invitation_status' => 'rejected', 'approved_by' => User::factory()->create(['role' => 'owner'])->id, 'approved_at' => now()]);

        $response = $this->actingAs($this->outletStaff)->get('/outlet/my-couriers');

        $response->assertInertia(fn ($page) => $page
            ->component('outlet/my-couriers/index')
            ->has('active', 1)
            ->where('active.0.id', $activeUser->courierProfile->id)
            ->has('pending', 1)
            ->where('pending.0.nominee_name', 'Pending')
            ->has('rejected', 1)
            ->where('rejected.0.nominee_name', 'Rejected')
        );
    }

    public function test_active_includes_plotted_pusat_courier(): void
    {
        $pusatUser = User::factory()->create(['role' => 'courier']);
        $pusatProfile = CourierProfile::create(['user_id' => $pusatUser->id, 'courier_source' => 'pusat', 'invitation_status' => 'accepted']);
        $pusatProfile->assignedOutlets()->attach($this->outlet->id);

        $response = $this->actingAs($this->outletStaff)->get('/outlet/my-couriers');

        $response->assertInertia(fn ($page) => $page->has('active', 1));
    }

    public function test_active_excludes_other_outlet_courier(): void
    {
        $otherUser = User::factory()->create(['role' => 'courier']);
        CourierProfile::create(['user_id' => $otherUser->id, 'courier_source' => 'outlet', 'outlet_id' => $this->otherOutlet->id, 'invitation_status' => 'accepted']);

        $response = $this->actingAs($this->outletStaff)->get('/outlet/my-couriers');

        $response->assertInertia(fn ($page) => $page->has('active', 0));
    }
}
