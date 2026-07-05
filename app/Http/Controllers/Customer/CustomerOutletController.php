<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Services\Concerns\CalculatesDistance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerOutletController extends Controller
{
    use CalculatesDistance;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $latitude = isset($validated['latitude']) ? (float) $validated['latitude'] : null;
        $longitude = isset($validated['longitude']) ? (float) $validated['longitude'] : null;

        $outlets = Outlet::query()
            ->active()
            ->get();

        $result = $outlets->map(function (Outlet $outlet) use ($latitude, $longitude): array {
            $distanceKm = null;

            if ($latitude !== null && $longitude !== null && $outlet->latitude !== null && $outlet->longitude !== null) {
                $distanceKm = round($this->calculateDistance(
                    $latitude,
                    $longitude,
                    (float) $outlet->latitude,
                    (float) $outlet->longitude,
                ), 2);
            }

            $hasStock = $outlet->inventories()
                ->where('is_active', true)
                ->whereRaw('current_stock - reserved_stock > 0')
                ->exists();

            return [
                'id' => $outlet->id,
                'name' => $outlet->name,
                'address' => $outlet->address,
                'kelurahan' => $outlet->kelurahan,
                'kecamatan' => $outlet->kecamatan,
                'phone' => $outlet->phone,
                'distance_km' => $distanceKm,
                'stock_available' => $hasStock,
            ];
        });

        // Sort: by distance if available, otherwise by name
        if ($latitude !== null && $longitude !== null) {
            $result = $result->sortBy('distance_km')->values();
        } else {
            $result = $result->sortBy('name')->values();
        }

        return response()->json(['outlets' => $result]);
    }
}
