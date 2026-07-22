<?php

namespace App\Services;

use App\Models\Outlet;
use App\Services\Concerns\CalculatesDistance;
use Illuminate\Support\Collection;

class OutletAssignmentService
{
    use CalculatesDistance;

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
        $local = now('Asia/Jakarta');
        $today = $local->toDateString();
        $outlets = $outlets->reject(function (Outlet $outlet) use ($today) {
            return $outlet->holidays()
                ->where('start_date', '<=', $today)
                ->where('end_date', '>=', $today)
                ->exists();
        });

        // Filter out closed hours
        $currentTime = $local->format('H:i:s');
        $currentDay = (int) $local->format('w'); // 0=Sunday
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

            return $this->outletHasEnoughStock($outlet, $items, false);
        });
    }

    public function outletHasEnoughStock(Outlet $outlet, array $items, bool $lockForUpdate = false): bool
    {
        $inventories = null;

        if ($lockForUpdate) {
            $inventories = \App\Models\OutletInventory::query()
                ->where('outlet_id', $outlet->id)
                ->where('is_active', true)
                ->lockForUpdate()
                ->get()
                ->keyBy('product_variant_id');
        } else {
            $inventories = $outlet->inventories->where('is_active', true)->keyBy('product_variant_id');
        }

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
}
