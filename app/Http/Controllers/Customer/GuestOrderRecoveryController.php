<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\GuestOrderRecoveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GuestOrderRecoveryController extends Controller
{
    public function __invoke(Request $request, GuestOrderRecoveryService $recoveryService): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'min:8', 'max:20'],
            'recovery_token' => ['nullable', 'string', 'between:8,64', 'alpha_num'],
            'order_code' => ['nullable', 'string', 'max:30'],
        ]);

        $result = $recoveryService->recover(
            $validated['phone'],
            $validated['recovery_token'] ?? null,
            $validated['order_code'] ?? null,
        );

        // Store recovery session only when second factor was verified
        if (! empty($result['customer_id']) && empty($result['requires_verification']) && ! auth()->check()) {
            $verifiedOrderIds = [];
            if ($validated['recovery_token'] ?? null) {
                $order = Order::where('recovery_token', $validated['recovery_token'])->first();
                if ($order) {
                    $verifiedOrderIds[] = $order->id;
                }
            } elseif ($validated['order_code'] ?? null) {
                $order = Order::where('order_code', $validated['order_code'])->first();
                if ($order) {
                    $verifiedOrderIds[] = $order->id;
                }
            }

            if (! empty($verifiedOrderIds)) {
                session()->put('guest_recovery', [
                    'customer_id' => $result['customer_id'],
                    'order_ids' => $verifiedOrderIds,
                    'recovery_verified_at' => now()->toISOString(),
                ]);
            }
        }

        return response()->json($result);
    }
}
