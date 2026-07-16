<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class LowStockNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $productName,
        public int $available,
        public int $minimum,
        public int $outletId,
        public bool $isCritical,
    ) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, mixed $notification): WebPushMessage
    {
        $title = $this->isCritical ? '⚠️ Stok Kritis' : '⚠️ Stok Rendah';
        $body = "{$this->productName}: tersedia {$this->available}, minimum {$this->minimum}.";

        return (new WebPushMessage)
            ->title($title)
            ->body($body)
            ->icon('/icons/icon-192.png')
            ->action('/outlet/restocks', 'Lihat Restock')
            ->options([
                'tag' => 'low-stock-'.$this->outletId,
                'renotify' => true,
                'vibrate' => $this->isCritical ? [200, 100, 200, 100, 200] : [200, 100, 200],
            ]);
    }
}
