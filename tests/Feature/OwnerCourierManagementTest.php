<?php

namespace Tests\Feature;

use App\Models\CourierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
            'invitation_status' => 'pending',
        ]);
    }

    public function test_owner_can_list_couriers(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        CourierProfile::create(['user_id' => $courier->id, 'invitation_status' => 'accepted']);

        $response = $this->actingAs($this->owner)->get('/owner/couriers');

        $response->assertStatus(200);
    }

    public function test_owner_can_view_courier_detail(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        CourierProfile::create(['user_id' => $courier->id, 'invitation_status' => 'accepted']);

        $response = $this->actingAs($this->owner)->get("/owner/couriers/{$courier->id}");

        $response->assertStatus(200);
    }
}
