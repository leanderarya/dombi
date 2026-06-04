<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierAvailabilityController extends Controller
{
    public function toggleOnline(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->is_online) {
            $user->goOffline();
        } else {
            $user->goOnline();
        }

        return response()->json([
            'is_online' => $user->is_online,
            'message' => $user->is_online ? 'Anda sekarang online' : 'Anda sekarang offline',
        ]);
    }

    public function startShift(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isOnShift()) {
            return response()->json([
                'message' => 'Anda sudah dalam shift.',
                'is_on_shift' => true,
                'shift_started_at' => $user->shift_started_at?->toISOString(),
            ], 422);
        }

        $user->startShift();
        $user->recordActivity();

        return response()->json([
            'is_online' => $user->is_online,
            'is_on_shift' => true,
            'shift_started_at' => $user->fresh()->shift_started_at?->toISOString(),
            'message' => 'Shift dimulai. Anda sekarang online.',
        ]);
    }

    public function endShift(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->isOnShift()) {
            return response()->json([
                'message' => 'Anda belum memulai shift.',
                'is_on_shift' => false,
            ], 422);
        }

        // Safety check: cannot end shift with active deliveries
        $activeDeliveries = Delivery::where('courier_id', $user->id)
            ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->count();

        if ($activeDeliveries > 0) {
            return response()->json([
                'message' => "Anda masih memiliki {$activeDeliveries} delivery aktif. Selesaikan atau serahkan terlebih dahulu.",
                'is_on_shift' => true,
                'active_deliveries' => $activeDeliveries,
            ], 422);
        }

        $user->endShift();

        return response()->json([
            'is_online' => $user->is_online,
            'is_on_shift' => false,
            'shift_ended_at' => $user->fresh()->shift_ended_at?->toISOString(),
            'message' => 'Shift selesai. Anda sekarang offline.',
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        $activeDeliveries = Delivery::where('courier_id', $user->id)
            ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->count();

        return response()->json([
            'is_online' => $user->is_online,
            'is_on_shift' => $user->isOnShift(),
            'shift_started_at' => $user->shift_started_at?->toISOString(),
            'shift_ended_at' => $user->shift_ended_at?->toISOString(),
            'active_deliveries' => $activeDeliveries,
        ]);
    }
}
