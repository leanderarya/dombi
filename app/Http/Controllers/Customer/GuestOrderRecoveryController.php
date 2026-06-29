<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Services\GuestOrderRecoveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GuestOrderRecoveryController extends Controller
{
    public function __invoke(Request $request, GuestOrderRecoveryService $recoveryService): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'min:8', 'max:20'],
        ]);

        // Guest users only see active orders
        $isGuest = ! auth()->check();
        $result = $recoveryService->recover($validated['phone'], activeOnly: $isGuest);

        // Store recovery session for guest users
        if (! empty($result['customer_id']) && ! auth()->check()) {
            $allOrders = array_merge(
                $result['active_orders'] ?? [],
                $result['recent_orders'] ?? [],
            );
            $orderIds = array_column($allOrders, 'id');

            if (! empty($orderIds)) {
                session()->put('guest_recovery', [
                    'customer_id' => $result['customer_id'],
                    'order_ids' => $orderIds,
                    'recovery_verified_at' => now()->toISOString(),
                ]);
            }
        }

        return response()->json($result);
    }
}
