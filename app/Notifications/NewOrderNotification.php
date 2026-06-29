<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class NewOrderNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Order $order,
    ) {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, mixed $notification): WebPushMessage
    {
        return (new WebPushMessage())
            ->title('Pesanan Baru')
            ->body("Pesanan {$this->order->order_code} dari {$this->order->customer_name}")
            ->icon('/icons/icon-192.png')
            ->action('/outlet/orders/' . $this->order->id, 'Lihat Pesanan')
            ->options([
                'tag' => 'new-order-' . $this->order->id,
                'renotify' => true,
                'vibrate' => [200, 100, 200],
            ]);
    }
}
