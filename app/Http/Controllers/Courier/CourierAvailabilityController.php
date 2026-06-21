<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CourierAvailabilityController extends Controller
{
    public function toggleOnline(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->is_online) {
            $user->goOffline();
        } else {
            $user->goOnline();
        }

        return redirect()->route('courier.dashboard')->with(
            'success',
            $user->is_online ? 'Anda sekarang online' : 'Anda sekarang offline',
        );
    }

    public function startShift(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->isOnShift()) {
            return redirect()->route('courier.dashboard')->with('warning', 'Anda sudah dalam shift.');
        }

        $user->startShift();
        $user->recordActivity();

        return redirect()->route('courier.dashboard')->with('success', 'Shift dimulai. Anda sekarang online.');
    }

    public function endShift(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user->isOnShift()) {
            return redirect()->route('courier.dashboard')->with('warning', 'Anda belum memulai shift.');
        }

        $activeDeliveries = Delivery::where('courier_id', $user->id)
            ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->count();

        if ($activeDeliveries > 0) {
            return redirect()->route('courier.dashboard')->with(
                'error',
                "Anda masih memiliki {$activeDeliveries} delivery aktif. Selesaikan atau serahkan terlebih dahulu.",
            );
        }

        $user->endShift();

        return redirect()->route('courier.dashboard')->with('success', 'Shift selesai. Anda sekarang offline.');
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
