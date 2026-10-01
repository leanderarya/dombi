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
            // A courier who still holds a task must not vanish from the
            // outlet's available list: the outlet reads is_online to find
            // someone for the next assignment, and location tracking stops
            // the moment they go offline. Going offline is for the end of a
            // shift, not for the middle of a delivery.
            if ($user->hasActiveDeliveries()) {
                return redirect()->route('courier.dashboard')->withErrors([
                    'availability' => 'Masih ada pengiriman aktif. Selesaikan atau kembalikan dulu sebelum offline.',
                ]);
            }

            $user->goOffline();
        } else {
            $user->goOnline();
        }

        return redirect()->route('courier.dashboard')->with(
            'success',
            $user->is_online ? 'Anda sekarang online' : 'Anda sekarang offline',
        );
    }

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        $activeDeliveries = Delivery::where('courier_id', $user->id)
            ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->count();

        return response()->json([
            'is_online' => $user->is_online,
            'active_deliveries' => $activeDeliveries,
        ]);
    }
}
