<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Services\CourierLocationService;
use Illuminate\Http\JsonResponse;

class CourierController extends Controller
{
    public function __construct(
        private readonly CourierLocationService $locationService,
    ) {}

    public function nearestCouriers(Outlet $outlet): JsonResponse
    {
        $couriers = $this->locationService->getNearestCouriers(
            (float) $outlet->latitude,
            (float) $outlet->longitude,
        );

        $result = $couriers->map(fn ($courier) => [
            'id' => $courier->id,
            'name' => $courier->name,
            'phone' => $courier->phone,
            'vehicle_type' => $courier->vehicle_type,
            'vehicle_plate' => $courier->vehicle_plate,
            'photo' => $courier->photo,
            'distance' => round($courier->distance, 2),
            'active_delivery_count' => $courier->activeDeliveryCount(),
        ]);

        return response()->json($result);
    }
}