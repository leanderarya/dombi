<?php

namespace App\Services;

use App\Models\Outlet;
use Illuminate\Support\Collection;

class OutletAssignmentService
{
    public function findAvailableOutlet(?float $lat, ?float $lng, array $items): ?Outlet
    {
        return $this->findCandidateOutlets($lat, $lng, $items)->first();
    }

    /**
     * @return Collection<int, Outlet>
     */
    public function findCandidateOutlets(?float $lat, ?float $lng, array $items): Collection
    {
        $outlets = Outlet::query()
            ->active()
            ->with('inventories')
            ->get();

        // Filter out holidays
        $today = now()->toDateString();
        $outlets = $outlets->reject(function (Outlet $outlet) use ($today) {
            return $outlet->holidays()
                ->where('start_date', '<=', $today)
                ->where('end_date', '>=', $today)
                ->exists();
        });

        // Filter out closed hours
        $currentTime = now()->format('H:i:s');
        $currentDay = (int) now()->format('w'); // 0=Sunday
        $outlets = $outlets->reject(function (Outlet $outlet) use ($currentTime, $currentDay) {
            $hours = $outlet->operatingHours()->where('day_of_week', $currentDay)->first();
            if ($hours && $hours->is_closed) {
                return true;
            }
            if ($hours && ! $hours->isOpenAt($currentTime)) {
                return true;
            }

            return false;
        });

        // Sort by distance if location available
        if ($lat !== null && $lng !== null) {
            $outlets = $outlets
                ->sortBy(fn (Outlet $outlet): float => $outlet->latitude !== null && $outlet->longitude !== null
                    ? $this->calculateDistance($lat, $lng, (float) $outlet->latitude, (float) $outlet->longitude)
                    : PHP_FLOAT_MAX)
                ->values();
        }

        // Filter by delivery radius (if applicable) and stock
        return $outlets->filter(function (Outlet $outlet) use ($lat, $lng, $items) {
            // Check delivery radius
            if ($lat !== null && $lng !== null && $outlet->delivery_radius_km && $outlet->latitude && $outlet->longitude) {
                $distance = $this->calculateDistance($lat, $lng, (float) $outlet->latitude, (float) $outlet->longitude);
                if ($distance > $outlet->delivery_radius_km) {
                    return false;
                }
            }

            return $this->outletHasEnoughStock($outlet, $items);
        });
    }

    public function outletHasEnoughStock(Outlet $outlet, array $items): bool
    {
        // Only check active inventories
        $inventories = $outlet->inventories->where('is_active', true)->keyBy('product_variant_id');

        foreach ($items as $item) {
            $variantId = (int) ($item['product_variant_id'] ?? 0);
            if (! $variantId) {
                continue;
            }

            $inventory = $inventories->get($variantId);

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
