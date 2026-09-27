<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CourierLocationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierLocationReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_courier_can_report_their_location(): void
    {
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
            'must_change_password' => false,
            'latitude' => null,
            'longitude' => null,
            'location_updated_at' => null,
        ]);

        $this->actingAs($courier)
            ->postJson('/courier/location', [
                'latitude' => -7.0568,
                'longitude' => 110.4381,
            ])
            ->assertOk();

        $courier->refresh();

        $this->assertEqualsWithDelta(-7.0568, (float) $courier->latitude, 0.0000001);
        $this->assertEqualsWithDelta(110.4381, (float) $courier->longitude, 0.0000001);
        $this->assertNotNull($courier->location_updated_at);
        $this->assertLessThanOrEqual(
            CourierLocationService::FRESH_MINUTES,
            (int) $courier->location_updated_at->diffInMinutes(now()),
        );
    }

    public function test_a_coordinate_outside_the_globe_is_rejected(): void
    {
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($courier)
            ->postJson('/courier/location', [
                'latitude' => 120,
                'longitude' => 110.4381,
            ])
            ->assertStatus(422);

        $this->assertNull($courier->fresh()->latitude);
    }

    public function test_a_non_courier_cannot_report_a_location(): void
    {
        // RoleMiddleware sends them to their own dashboard rather than a 403, so
        // the property to assert is that nothing was written.
        $owner = User::factory()->create([
            'role' => 'owner',
            'is_active' => true,
            'must_change_password' => false,
            'latitude' => -1.0,
            'longitude' => -1.0,
        ]);

        $this->actingAs($owner)
            ->postJson('/courier/location', [
                'latitude' => -7.0568,
                'longitude' => 110.4381,
            ])
            ->assertRedirect();

        $owner->refresh();

        $this->assertSame(-1.0, (float) $owner->latitude);
        $this->assertSame(-1.0, (float) $owner->longitude);
    }
}
