<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Services\CourierLocationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function __construct(
        private readonly CourierLocationService $locationService,
    ) {}

    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $user = $request->user();

        if (!$user->isCourier()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->locationService->updateLocation(
            $user,
            $request->input('latitude'),
            $request->input('longitude'),
        );

        return response()->json(['message' => 'Location updated']);
    }
}
