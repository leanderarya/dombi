<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Collection;

class CourierLocationService
{
    public function updateLocation(User $courier, float $latitude, float $longitude): void
    {
        $courier->update([
            'latitude' => $latitude,
            'longitude' => $longitude,
            'location_updated_at' => now(),
        ]);
    }

    public function getNearestCouriers(float $outletLat, float $outletLng, int $limit = 10): Collection
    {
        return User::query()
            ->where('role', 'courier')
            ->where('is_online', true)
            ->where('is_active', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->where('location_updated_at', '>=', now()->subMinutes(5))
            ->selectRaw("
                *,
                (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance
            ", [$outletLat, $outletLng, $outletLat])
            ->having('distance', '<=', 50)
            ->orderBy('distance')
            ->limit($limit)
            ->get();
    }

    public function hasActiveLocation(User $courier): bool
    {
        return $courier->latitude !== null
            && $courier->longitude !== null
            && $courier->location_updated_at !== null
            && $courier->location_updated_at->diffInMinutes(now()) <= 5;
    }
}
