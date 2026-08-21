<?php

namespace Tests\Feature;

use App\Models\CourierInvitation;
use App\Models\CourierProfile;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OwnerCourierManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
    }

    public function test_owner_can_create_courier(): void
    {
        $response = $this->actingAs($this->owner)->post('/owner/couriers', [
            'name' => 'Budi Kurir',
            'phone' => '6281234567890',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('users', [
            'name' => 'Budi Kurir',
            'phone' => '6281234567890',
            'role' => 'courier',
        ]);
        $courier = User::where('phone', '6281234567890')->first();
        $this->assertDatabaseHas('courier_profiles', [
            'user_id' => $courier->id,
            'invitation_status' => CourierProfile::STATUS_AWAITING_ACTIVATION,
        ]);
    }

    public function test_owner_can_list_couriers(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        CourierProfile::create(['user_id' => $courier->id, 'invitation_status' => CourierProfile::STATUS_ACTIVE]);

        $response = $this->actingAs($this->owner)->get('/owner/couriers');

        $response->assertStatus(200);
    }

    public function test_owner_can_view_courier_detail(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        CourierProfile::create(['user_id' => $courier->id, 'invitation_status' => CourierProfile::STATUS_ACTIVE]);

        $response = $this->actingAs($this->owner)->get("/owner/couriers/{$courier->id}");

        $response->assertStatus(200);
    }

    public function test_owner_cannot_open_non_courier_user_through_courier_detail(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet']);

        $response = $this->actingAs($this->owner)->get("/owner/couriers/{$outletUser->id}");

        $response->assertNotFound();
    }

    public function test_owner_cannot_update_non_courier_user_through_courier_route(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet', 'name' => 'Outlet Lama']);

        $response = $this->actingAs($this->owner)->put("/owner/couriers/{$outletUser->id}", [
            'name' => 'Outlet Baru',
        ]);

        $response->assertNotFound();
        $this->assertDatabaseHas('users', [
            'id' => $outletUser->id,
            'name' => 'Outlet Lama',
        ]);
    }

    public function test_owner_cannot_delete_non_courier_user_through_courier_route(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet']);

        $response = $this->actingAs($this->owner)->delete("/owner/couriers/{$outletUser->id}");

        $response->assertNotFound();
        $this->assertDatabaseHas('users', ['id' => $outletUser->id]);
    }

    public function test_owner_can_open_management_page_without_resource_collision(): void
    {
        $response = $this->actingAs($this->owner)->get('/owner/couriers/management');

        $response->assertStatus(200);
    }

    public function test_management_page_includes_nominee_identity_for_candidates(): void
    {
        CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => null,
            'nominee_name' => 'Bambang Outlet',
            'nominee_phone' => '081234567890',
            'nominee_vehicle_plate' => 'AB 1234 CD',
            'nominee_face_photo' => 'faces/a.jpg',
            'nominee_vehicle_photo' => 'vehicles/b.jpg',
            'invitation_status' => CourierProfile::STATUS_SUBMITTED,
        ]);

        $this->actingAs($this->owner)
            ->get('/owner/couriers/management')
            ->assertInertia(fn ($page) => $page
                ->component('owner/courier-management/index')
                ->where('candidates.0.nominee_name', 'Bambang Outlet')
                ->where('candidates.0.nominee_phone', '081234567890'));
    }

    public function test_courier_can_view_invite_page(): void
    {
        $this->actingAs($this->owner)->post('/owner/couriers', [
            'name' => 'Budi Kurir',
            'phone' => '6281234567890',
        ]);

        $invitation = CourierInvitation::first();
        $response = $this->get("/courier/invite/{$invitation->token}");

        $response->assertStatus(200);
    }

    public function test_courier_can_accept_invite(): void
    {
        $this->actingAs($this->owner)->post('/owner/couriers', [
            'name' => 'Budi Kurir',
            'phone' => '6281234567890',
        ]);

        $invitation = CourierInvitation::first();
        $response = $this->post("/courier/invite/{$invitation->token}", [
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertRedirect();
        $invitation->refresh();
        $this->assertEquals('accepted', $invitation->status);
        $this->assertNotNull($invitation->accepted_at);

        $courier = $invitation->courierUser;
        $this->assertTrue(Hash::check('password123', $courier->password));
        $this->assertFalse($courier->fresh()->must_change_password);

        $profile = CourierProfile::where('user_id', $courier->id)->first();
        $this->assertEquals(CourierProfile::STATUS_ACTIVE, $profile->invitation_status);
    }

    public function test_expired_invite_shows_expired_page(): void
    {
        $this->actingAs($this->owner)->post('/owner/couriers', [
            'name' => 'Budi Kurir',
            'phone' => '6281234567890',
        ]);

        $invitation = CourierInvitation::first();
        $invitation->update(['expires_at' => now()->subDay()]);

        $response = $this->get("/courier/invite/{$invitation->token}");

        $response->assertStatus(200);
    }

    public function test_invalid_token_returns_404(): void
    {
        $response = $this->get('/courier/invite/invalidtoken');

        $response->assertStatus(404);
    }

    public function test_owner_can_delete_courier(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        CourierProfile::create(['user_id' => $courier->id, 'invitation_status' => CourierProfile::STATUS_ACTIVE]);

        $response = $this->actingAs($this->owner)->delete("/owner/couriers/{$courier->id}");

        $response->assertRedirect();
        $this->assertDatabaseMissing('users', ['id' => $courier->id]);
        $this->assertDatabaseMissing('courier_profiles', ['user_id' => $courier->id]);
    }

    public function test_owner_cannot_delete_courier_with_active_deliveries(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        CourierProfile::create(['user_id' => $courier->id, 'invitation_status' => CourierProfile::STATUS_ACTIVE]);

        $order = Order::factory()->create();
        Delivery::create([
            'order_id' => $order->id,
            'courier_id' => $courier->id,
            'status' => 'picked_up',
        ]);

        $response = $this->actingAs($this->owner)->delete("/owner/couriers/{$courier->id}");

        $response->assertRedirect();
        $this->assertDatabaseHas('users', ['id' => $courier->id]);
    }
}
