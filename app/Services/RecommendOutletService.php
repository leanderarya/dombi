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
        if (count($items) === 0) {
            return [
                'recommended' => null,
                'alternatives' => [],
            ];
        }

        $availableOutlets = Outlet::query()
            ->where('status', 'active')
            ->with('inventories')
            ->get()
            ->filter(fn (Outlet $outlet): bool => $this->outletAssignmentService->outletHasEnoughStock($outlet, $items))
            ->values();

        $sorted = $this->sortOutlets($availableOutlets, $latitude, $longitude)
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
            'stock_available' => true,
        ];
    }
}
