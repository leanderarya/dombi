<?php

namespace App\Services;

use App\Models\Outlet;

class OutletAssignmentService
{
    public function findAvailableOutlet(?float $lat, ?float $lng, array $items): ?Outlet
    {
        return $this->findCandidateOutlets($lat, $lng, $items)->first();
    }

    /**
     * @return \Illuminate\Support\Collection<int, Outlet>
     */
    public function findCandidateOutlets(?float $lat, ?float $lng, array $items): \Illuminate\Support\Collection
    {
        $outlets = Outlet::query()
            ->where('status', 'active')
            ->with('inventories')
            ->get();

        if ($lat !== null && $lng !== null) {
            $outlets = $outlets
                ->sortBy(fn (Outlet $outlet): float => $outlet->latitude !== null && $outlet->longitude !== null
                    ? $this->calculateDistance($lat, $lng, (float) $outlet->latitude, (float) $outlet->longitude)
                    : PHP_FLOAT_MAX)
                ->values();
        }

        return $outlets->filter(fn (Outlet $outlet): bool => $this->outletHasEnoughStock($outlet, $items));
    }

    public function outletHasEnoughStock(Outlet $outlet, array $items): bool
    {
        $inventories = $outlet->inventories->keyBy('product_id');

        foreach ($items as $item) {
            $inventory = $inventories->get((int) $item['product_id']);

            if (! $inventory) {
                return false;
            }

            if (($inventory->current_stock - $inventory->reserved_stock) < (int) $item['quantity']) {
                return false;
            }
        }

        return true;
    }

    public function calculateDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;

        return $earthRadius * (2 * atan2(sqrt($a), sqrt(1 - $a)));
    }
}
