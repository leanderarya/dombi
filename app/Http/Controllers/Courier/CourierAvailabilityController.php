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
