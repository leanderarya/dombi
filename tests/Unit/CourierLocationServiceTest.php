<?php

namespace Tests\Unit;

use App\Models\User;
use App\Services\CourierLocationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Tests\TestCase;

class CourierLocationServiceTest extends TestCase
{
    use RefreshDatabase;

    private const OUTLET_LAT = -7.0568000;

    private const OUTLET_LNG = 110.4381000;

    private CourierLocationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new CourierLocationService;
    }

    /**
     * @param  array<int, int>  $courierIds
     * @return Collection<int, User>
     */
    private function rank(array $courierIds): Collection
    {
        return $this->service->rankForOutlet(
            self::OUTLET_LAT,
            self::OUTLET_LNG,
            collect($courierIds),
        );
    }

    private function courier(array $attributes = []): User
    {
        return User::factory()->create([
            'role' => 'courier',
            'is_online' => true,
            'is_active' => true,
            'latitude' => -7.0570000,
            'longitude' => 110.4383000,
            'location_updated_at' => now(),
            ...$attributes,
        ]);
    }

    public function test_couriers_are_sorted_by_distance(): void
    {
        $near = $this->courier();
        $far = $this->courier(['latitude' => -7.0900000, 'longitude' => 110.4700000]);

        $ranked = $this->rank([$far->id, $near->id]);

        $this->assertSame([$near->id, $far->id], $ranked->pluck('id')->all());
    }

    public function test_a_courier_with_a_stale_location_is_still_offered_without_a_distance(): void
    {
        $stale = $this->courier([
            'location_updated_at' => now()->subMinutes(
                CourierLocationService::FRESH_MINUTES + 10,
            ),
        ]);

        $ranked = $this->rank([$stale->id]);

        $this->assertCount(1, $ranked, 'Location ranks couriers, it does not gate them.');
        $this->assertNull($ranked->first()->distance);
    }

    public function test_a_courier_with_no_location_at_all_is_still_offered(): void
    {
        $withoutLocation = $this->courier([
            'latitude' => null,
            'longitude' => null,
            'location_updated_at' => null,
        ]);

        $ranked = $this->rank([$withoutLocation->id]);

        $this->assertCount(1, $ranked);
        $this->assertNull($ranked->first()->distance);
    }

    public function test_couriers_with_a_distance_come_before_those_without(): void
    {
        $withoutLocation = $this->courier([
            'latitude' => null,
            'longitude' => null,
            'location_updated_at' => null,
        ]);
        $withLocation = $this->courier();

        $ranked = $this->rank([$withoutLocation->id, $withLocation->id]);

        $this->assertSame(
            [$withLocation->id, $withoutLocation->id],
            $ranked->pluck('id')->all(),
        );
    }

    public function test_offline_couriers_are_excluded(): void
    {
        $offline = $this->courier(['is_online' => false]);

        $this->assertCount(0, $this->rank([$offline->id]));
    }

    public function test_couriers_outside_the_given_ids_are_excluded(): void
    {
        $eligible = $this->courier();
        $this->courier(['latitude' => -7.0571000, 'longitude' => 110.4384000]);

        $ranked = $this->rank([$eligible->id]);

        $this->assertSame([$eligible->id], $ranked->pluck('id')->all());
    }

    public function test_an_empty_id_list_returns_nothing(): void
    {
        $this->courier();

        $this->assertCount(0, $this->rank([]));
    }
}
