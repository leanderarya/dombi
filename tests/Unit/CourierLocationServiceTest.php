<?php

namespace Tests\Unit;

use App\Models\User;
use App\Services\CourierLocationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierLocationServiceTest extends TestCase
{
    use RefreshDatabase;

    private CourierLocationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new CourierLocationService();
    }

    public function test_nearest_couriers_sorted_by_distance(): void
    {
        $outletLat = -7.0568000;
        $outletLng = 110.4381000;

        $courier1 = User::factory()->create([
            'role' => 'courier',
            'is_online' => true,
            'is_active' => true,
            'latitude' => -7.0570000,
            'longitude' => 110.4383000,
            'location_updated_at' => now(),
        ]);

        $courier2 = User::factory()->create([
            'role' => 'courier',
            'is_online' => true,
            'is_active' => true,
            'latitude' => -7.0600000,
            'longitude' => 110.4400000,
            'location_updated_at' => now(),
        ]);

        $courier3 = User::factory()->create([
            'role' => 'courier',
            'is_online' => true,
            'is_active' => true,
            'latitude' => -7.0550000,
            'longitude' => 110.4370000,
            'location_updated_at' => now(),
        ]);

        $nearest = $this->service->getNearestCouriers($outletLat, $outletLng);

        $this->assertCount(3, $nearest);
        $this->assertEquals($courier1->id, $nearest->first()->id);
    }

    public function test_couriers_without_active_location_excluded(): void
    {
        $outletLat = -7.0568000;
        $outletLng = 110.4381000;

        User::factory()->create([
            'role' => 'courier',
            'is_online' => true,
            'is_active' => true,
            'latitude' => -7.0570000,
            'longitude' => 110.4383000,
            'location_updated_at' => now()->subMinutes(10),
        ]);

        $nearest = $this->service->getNearestCouriers($outletLat, $outletLng);

        $this->assertCount(0, $nearest);
    }

    public function test_offline_couriers_excluded(): void
    {
        $outletLat = -7.0568000;
        $outletLng = 110.4381000;

        User::factory()->create([
            'role' => 'courier',
            'is_online' => false,
            'is_active' => true,
            'latitude' => -7.0570000,
            'longitude' => 110.4383000,
            'location_updated_at' => now(),
        ]);

        $nearest = $this->service->getNearestCouriers($outletLat, $outletLng);

        $this->assertCount(0, $nearest);
    }
}
