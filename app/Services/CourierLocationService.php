<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Collection;

class CourierLocationService
{
    /** How long a reported position stays usable for ranking. */
    public const FRESH_MINUTES = 5;

    public function updateLocation(User $courier, float $latitude, float $longitude): void
    {
        $courier->update([
            'latitude' => $latitude,
            'longitude' => $longitude,
            'location_updated_at' => now(),
        ]);
    }

    /**
     * The couriers the outlet may assign to, nearest first.
     *
     * Location only ranks them here. A courier whose fix is missing or stale is
     * still returned, just with a null distance, so a closed tab or a denied
     * permission cannot hide someone the outlet is allowed to use - which is what
     * the old freshness and radius filters did.
     *
     * @param  Collection<int, int|string>  $courierIds
     * @return Collection<int, User>
     */
    public function rankForOutlet(float $outletLat, float $outletLng, Collection $courierIds): Collection
    {
        if ($courierIds->isEmpty()) {
            return collect();
        }

        $distance = '(6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))';

        return User::query()
            ->whereIn('id', $courierIds)
            ->where('is_online', true)
            ->where('is_active', true)
            ->selectRaw(
                "*, CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND location_updated_at >= ? THEN {$distance} END AS distance",
                [now()->subMinutes(self::FRESH_MINUTES), $outletLat, $outletLng, $outletLat],
            )
            ->orderByRaw('distance IS NULL')
            ->orderBy('distance')
            ->get();
    }
}
