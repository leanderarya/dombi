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

        $result = $recoveryService->recoverByPhone($validated['phone']);

        return response()->json($result);
    }
}
