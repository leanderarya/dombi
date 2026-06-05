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
            'recovery_token' => ['nullable', 'string', 'between:8,64', 'alpha_num'],
            'order_code' => ['nullable', 'string', 'max:30'],
        ]);

        $result = $recoveryService->recover(
            $validated['phone'],
            $validated['recovery_token'] ?? null,
            $validated['order_code'] ?? null,
        );

        // Store recovery session for guest reorder authorization
        // Only when a second factor (token or order code) was verified — not phone-only lookups
        $hasVerification = ! empty($validated['recovery_token']) || ! empty($validated['order_code']);
        if ($hasVerification && $result['found'] && ! auth()->check()) {
            $orderIds = collect($result['active_orders'])->pluck('id')
                ->merge(collect($result['recent_orders'])->pluck('id'))
                ->filter()
                ->values()
                ->all();

            if (! empty($orderIds) && ! empty($result['customer_id'])) {
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
