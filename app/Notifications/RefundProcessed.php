<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class RefundProcessed extends Notification
{
    use Queueable;

    public function __construct(public Order $order, public float $amount) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'refund_processed',
            'order_id' => $this->order->id,
            'order_code' => $this->order->order_code,
            'amount' => $this->amount,
            'message' => 'Refund sebesar Rp ' . number_format($this->amount, 0, ',', '.') .
                ' untuk pesanan ' . $this->order->order_code . ' sudah selesai. Silakan cek rekening Anda.',
        ];
    }
}
