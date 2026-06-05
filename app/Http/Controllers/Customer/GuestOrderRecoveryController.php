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
            'recovery_token' => ['nullable', 'string', 'size:32'],
            'order_code' => ['nullable', 'string', 'max:30'],
        ]);

        if (empty($validated['recovery_token']) && empty($validated['order_code'])) {
            return response()->json([
                'found' => false,
                'message' => 'Token pemulihan atau kode pesanan wajib diisi.',
                'active_orders' => [],
                'recent_orders' => [],
            ], 422);
        }

        $result = $recoveryService->recover(
            $validated['phone'],
            $validated['recovery_token'] ?? null,
            $validated['order_code'] ?? null,
        );

        return response()->json($result);
    }
}
