<?php

namespace App\Notifications;

use App\Models\OrderReport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class NewOrderReportNotification extends Notification implements ShouldQueue
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
            'type' => 'new_order_report',
            'title' => 'Laporan Masalah Baru',
            'message' => "Laporan dari {$this->report->customer->name} untuk pesanan {$this->report->order->order_code}",
            'order_id' => $this->report->order_id,
            'report_id' => $this->report->id,
        ];
    }
}
