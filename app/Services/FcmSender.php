<?php

namespace App\Services;

use App\Models\PushFcmToken;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmSender
{
    public function send(string $token, string $title, string $body, array $data = []): void
    {
        $serverKey = config('services.fcm.server_key');
        if (!$serverKey) {
            return;
        }

        $response = Http::withHeaders([
            'Authorization' => 'key=' . $serverKey,
            'Content-Type' => 'application/json',
        ])->post('https://fcm.googleapis.com/fcm/send', [
            'to' => $token,
            'notification' => [
                'title' => $title,
                'body' => $body,
                'sound' => 'default',
                'badge' => 1,
            ],
            'data' => $data,
        ]);

        if ($response->failed()) {
            $json = $response->json();
            if (($json['results'][0]['error'] ?? null) === 'NotRegistered') {
                PushFcmToken::where('fcm_token', $token)->delete();
            }
            Log::warning('FCM send failed', ['token' => substr($token, 0, 20), 'response' => $response->body()]);
        }
    }
}
