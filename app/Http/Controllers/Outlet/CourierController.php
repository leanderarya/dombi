<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\CourierProfile;
use App\Models\Outlet;
use App\Models\User;
use App\Services\CourierLocationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierController extends Controller
{
    public function __construct(
        private readonly CourierLocationService $locationService,
    ) {}

    public function nearestCouriers(Request $request, Outlet $outlet): JsonResponse
    {
        abort_unless($request->user()?->outlet?->id === $outlet->id, 403);

        $eligibleIds = CourierProfile::query()
            ->availableForOutlet($outlet->id)
            ->pluck('user_id');

        $couriers = $this->locationService->rankForOutlet(
            (float) $outlet->latitude,
            (float) $outlet->longitude,
            $eligibleIds,
        );

        $result = $couriers->map(fn (User $courier) => [
            'id' => $courier->id,
            'name' => $courier->name,
            'phone' => $courier->phone,
            'vehicle_type' => $courier->vehicle_type,
            'vehicle_plate' => $courier->vehicle_plate,
            'photo' => $courier->photo,
            'distance' => $courier->distance === null
                ? null
                : round((float) $courier->distance, 2),
            'active_delivery_count' => $courier->activeDeliveryCount(),
        ]);

        return response()->json($result);
    }
}
