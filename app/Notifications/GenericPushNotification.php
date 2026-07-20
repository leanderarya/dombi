<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class GenericPushNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $title,
        public string $body,
        public array $data = [],
    ) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, mixed $notification): WebPushMessage
    {
        $url = $this->data['url'] ?? '/';

        return (new WebPushMessage)
            ->title($this->title)
            ->body($this->body)
            ->icon('/favicon.png')
            ->action($url, 'Buka')
            ->options([
                'tag' => $this->data['tag'] ?? 'dombi-notification',
                'renotify' => true,
                'vibrate' => [200, 100, 200],
            ]);
    }
}
