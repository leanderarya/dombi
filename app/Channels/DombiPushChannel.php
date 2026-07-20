<?php

namespace App\Channels;

use App\Models\User;
use App\Notifications\GenericPushNotification;
use Illuminate\Notifications\Notification;

class DombiPushChannel
{
    public function send(User $notifiable, Notification $notification): void
    {
        if (!method_exists($notification, 'toWebPush')) {
            return;
        }

        $notifiable->notify(new GenericPushNotification(
            title: $notification->toWebPush($notifiable, $notification)->title ?? 'Dombi',
            body: $notification->toWebPush($notifiable, $notification)->body ?? '',
            data: $notification->data ?? [],
        ));
    }
}
