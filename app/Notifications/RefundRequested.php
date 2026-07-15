<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class RefundRequested extends Notification
{
    use Queueable;

    public function __construct(public Order $order) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'refund_requested',
            'order_id' => $this->order->id,
            'order_code' => $this->order->order_code,
            'message' => 'Pesanan ' . $this->order->order_code . ' dibatalkan. Refund sebesar Rp ' .
                number_format($this->order->total, 0, ',', '.') . ' sedang diproses.',
        ];
    }
}
