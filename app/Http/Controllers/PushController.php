<?php

namespace App\Http\Controllers;

use App\Models\PushFcmToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushController extends Controller
{
    public function subscribe(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'endpoint' => 'required|url',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
        ]);

        $user->updatePushSubscription(
            $validated['endpoint'],
            $validated['keys']['p256dh'],
            $validated['keys']['auth'],
            'aesgcm',
        );

        return response()->json(['success' => true]);
    }

    public function fcmToken(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string|max:500',
            'device_type' => 'nullable|string|max:50',
        ]);

        $user = $request->user();
        $customer = $user?->customer;

        PushFcmToken::updateOrCreate(
            ['fcm_token' => $request->token],
            [
                'user_id' => $user?->id,
                'customer_id' => $customer?->id,
                'device_type' => $request->device_type ?? 'android',
            ]
        );

        return response()->json(['success' => true]);
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $request->validate(['endpoint' => 'required|url']);

        $user = $request->user();
        $user->deletePushSubscription($request->endpoint);

        return response()->json(['success' => true]);
    }
}
