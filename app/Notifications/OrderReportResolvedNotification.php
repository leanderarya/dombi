<?php

namespace App\Notifications;

use App\Models\OrderReport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class OrderReportResolvedNotification extends Notification implements ShouldQueue
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
        $statusText = $this->report->isResolved() ? 'telah selesai' : 'ditolak';

        return [
            'type' => 'order_report_resolved',
            'title' => 'Laporan Pesanan ' . ucfirst($statusText),
            'message' => "Laporan Anda untuk pesanan {$this->report->order->order_code} {$statusText}.",
            'order_id' => $this->report->order_id,
            'report_id' => $this->report->id,
            'status' => $this->report->status,
            'resolution_notes' => $this->report->resolution_notes,
        ];
    }
}
