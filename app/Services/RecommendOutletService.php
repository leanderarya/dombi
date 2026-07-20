<?php

namespace App\Services;

use App\Models\Outlet;
use Illuminate\Support\Collection;

class RecommendOutletService
{
    public function __construct(
        private readonly OutletAssignmentService $outletAssignmentService,
    ) {}

    public function recommend(?float $latitude, ?float $longitude, array $items): array
    {
        // If no items, just return nearest outlets by distance
        if (count($items) === 0) {
            $outlets = Outlet::query()
                ->where('status', 'active')
                ->get();

            $sorted = $this->sortOutlets($outlets, $latitude, $longitude)
                ->values()
                ->map(fn (Outlet $outlet) => $this->formatOutlet($outlet, $latitude, $longitude))
                ->all();

            return [
                'recommended' => $sorted[0] ?? null,
                'alternatives' => $sorted,
            ];
        }

        $candidateOutlets = $this->outletAssignmentService->findCandidateOutlets($latitude, $longitude, $items);

        $sorted = $this->sortOutlets($candidateOutlets, $latitude, $longitude)
            ->values()
            ->map(fn (Outlet $outlet) => $this->formatOutlet($outlet, $latitude, $longitude))
            ->all();

        return [
            'recommended' => $sorted[0] ?? null,
            'alternatives' => $sorted,
        ];
    }

    public function recommendForDelivery(?float $latitude, ?float $longitude, array $items): ?array
    {
        $recommendation = $this->recommend($latitude, $longitude, $items);

        return $recommendation['recommended'] ?? null;
    }

    private function sortOutlets(Collection $outlets, ?float $latitude, ?float $longitude): Collection
    {
        if ($latitude === null || $longitude === null) {
            return $outlets->sortBy('name')->values();
        }

        return $outlets->sortBy(fn (Outlet $outlet): float => $outlet->latitude !== null && $outlet->longitude !== null
            ? $this->outletAssignmentService->calculateDistance(
                $latitude,
                $longitude,
                (float) $outlet->latitude,
                (float) $outlet->longitude,
            )
            : PHP_FLOAT_MAX);
    }

    private function formatOutlet(Outlet $outlet, ?float $latitude, ?float $longitude): array
    {
        $distanceKm = null;

        if ($latitude !== null && $longitude !== null && $outlet->latitude !== null && $outlet->longitude !== null) {
            $distanceKm = round($this->outletAssignmentService->calculateDistance(
                $latitude,
                $longitude,
                (float) $outlet->latitude,
                (float) $outlet->longitude,
            ), 2);
        }

        return [
            'id' => $outlet->id,
            'name' => $outlet->name,
            'address' => $outlet->address,
            'kelurahan' => $outlet->kelurahan,
            'kecamatan' => $outlet->kecamatan,
            'phone' => $outlet->phone,
            'distance_km' => $distanceKm,
            'is_open' => $outlet->isOpen(),
            'next_open' => $this->getNextOpenTime($outlet),
            'stock_available' => true,
        ];
    }

    private function getNextOpenTime(\App\Models\Outlet $outlet): ?string
    {
        $today = (int) now()->format('w');
        $hours = $outlet->operatingHours()->where('day_of_week', $today)->first();
        if ($hours && !$hours->is_closed) {
            return $hours->open_time;
        }

        for ($i = 1; $i <= 7; $i++) {
            $day = ($today + $i) % 7;
            $next = $outlet->operatingHours()->where('day_of_week', $day)->first();
            if ($next && !$next->is_closed) {
                return now()->addDays($i)->format('l') . ' ' . $next->open_time;
            }
        }

        return null;
    }
}
