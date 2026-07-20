<?php

namespace App\Services;

use App\Models\PushFcmToken;
use App\Models\User;
use App\Notifications\GenericPushNotification;

class PushNotificationService
{
    public function send(User $user, string $title, string $body, array $data = []): void
    {
        $user->notify(new GenericPushNotification(
            title: $title,
            body: $body,
            data: $data,
        ));

        $tokens = PushFcmToken::where('user_id', $user->id)->pluck('fcm_token');
        if ($tokens->isNotEmpty()) {
            $fcm = app(FcmSender::class);
            foreach ($tokens as $token) {
                $fcm->send($token, $title, $body, $data);
            }
        }
    }
}
