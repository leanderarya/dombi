<?php

namespace App\Notifications;

use App\Models\OrderReport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class OrderReportUpdatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public OrderReport $report,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'order_report_updated',
            'title' => 'Laporan Ditanggapi',
            'message' => "Laporan pesanan {$this->report->order->order_code} sedang ditinjau oleh outlet.",
            'order_id' => $this->report->order_id,
            'report_id' => $this->report->id,
            'status' => $this->report->status,
        ];
    }
}
