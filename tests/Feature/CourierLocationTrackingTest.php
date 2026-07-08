<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierLocationTrackingTest extends TestCase
{
    use RefreshDatabase;

    private User $courier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->courier = User::factory()->create(['role' => 'courier', 'is_online' => true]);
    }

    public function test_courier_can_update_location(): void
    {
        $response = $this->actingAs($this->courier)->post('/courier/location', [
            'latitude' => -7.0568000,
            'longitude' => 110.4381000,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('users', [
            'id' => $this->courier->id,
            'latitude' => -7.0568000,
            'longitude' => 110.4381000,
        ]);
    }

    public function test_location_updated_at_is_set(): void
    {
        $this->actingAs($this->courier)->post('/courier/location', [
            'latitude' => -7.0568000,
            'longitude' => 110.4381000,
        ]);

        $this->courier->refresh();
        $this->assertNotNull($this->courier->location_updated_at);
        $this->assertTrue($this->courier->location_updated_at->diffInSeconds(now()) < 5);
    }

    public function test_non_courier_cannot_update_location(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);

        $response = $this->actingAs($customer)->post('/courier/location', [
            'latitude' => -7.0568000,
            'longitude' => 110.4381000,
        ]);

        $response->assertRedirect();
    }
}
