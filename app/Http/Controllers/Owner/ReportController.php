<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Settlement;
use App\Support\QueryDate;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function exportCsv(Request $request): StreamedResponse
    {
        $dateFrom = QueryDate::parseOr($request->query('date_from'), fn () => today()->subDays(7));
        $dateTo = QueryDate::parseOr($request->query('date_to'), fn () => today());
        $outletId = $request->integer('outlet_id') ?: null;

        $filename = 'orders-report-'.$dateFrom->format('Ymd').'-'.$dateTo->format('Ymd').'.csv';

        return response()->streamDownload(function () use ($dateFrom, $dateTo, $outletId): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Kode Order', 'Customer', 'Outlet', 'Status', 'Total', 'Tanggal']);

            Order::query()
                ->with('outlet:id,name')
                ->whereBetween('created_at', [$dateFrom->startOfDay(), $dateTo->endOfDay()])
                ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
                ->latest()
                ->chunk(200, function ($orders) use ($handle): void {
                    foreach ($orders as $order) {
                        fputcsv($handle, [
                            $order->order_code,
                            $order->customer_name,
                            $order->outlet?->name ?? '-',
                            match ($order->status) {
                                'pending_confirmation' => 'Menunggu Konfirmasi',
                                'confirmed' => 'Dikonfirmasi',
                                'preparing' => 'Disiapkan',
                                'ready_for_pickup' => 'Siap Diambil',
                                'picked_up' => 'Diambil',
                                'delivering' => 'Dikirim',
                                'completed' => 'Selesai',
                                'cancelled_by_customer' => 'Dibatalkan Customer',
                                'cancelled_by_outlet' => 'Dibatalkan Outlet',
                                'rejected_by_outlet' => 'Ditolak Outlet',
                                'failed_delivery' => 'Gagal Kirim',
                                'expired' => 'Kedaluwarsa',
                                default => $order->status,
                            },
                            'Rp '.number_format($order->total, 0, ',', '.'),
                            $order->created_at->format('d/m/Y H:i'),
                        ]);
                    }
                });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function exportOrders(Request $request): StreamedResponse
    {
        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period);

        $orders = Order::where('status', 'completed')
            ->whereBetween('completed_at', [$from, $to])
            ->with(['outlet:id,name', 'items'])
            ->latest('completed_at')
            ->get();

        $filename = 'orders-'.$from->format('Y-m-d').'-'.$to->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($orders): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Tanggal', 'Order Code', 'Outlet', 'Customer', 'Total', 'Items']);

            foreach ($orders as $order) {
                fputcsv($handle, [
                    $order->completed_at->format('d/m/Y'),
                    $order->order_code,
                    $order->outlet->name,
                    $order->customer_name,
                    'Rp '.number_format($order->total, 0, ',', '.'),
                    $order->items->count(),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function exportSettlements(Request $request): StreamedResponse
    {
        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period);

        $settlements = Settlement::whereBetween('period_date', [$from, $to])
            ->with('outlet:id,name')
            ->get();

        $filename = 'settlements-'.$from->format('Y-m-d').'-'.$to->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($settlements): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Outlet', 'Periode', 'Jatuh Tempo', 'Tagihan', 'Dibayar', 'Sisa', 'Status']);

            foreach ($settlements as $s) {
                fputcsv($handle, [
                    $s->outlet->name,
                    $s->period_date->format('d/m/Y'),
                    $s->due_date->format('d/m/Y'),
                    'Rp '.number_format($s->amount_due, 0, ',', '.'),
                    'Rp '.number_format($s->paid_amount, 0, ',', '.'),
                    'Rp '.number_format($s->outstanding_amount, 0, ',', '.'),
                    match ($s->status) {
                        'pending' => 'Menunggu',
                        'partial' => 'Sebagian',
                        'paid' => 'Lunas',
                        'overdue' => 'Jatuh Tempo',
                        default => $s->status,
                    },
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    private function resolvePeriod(string $period): array
    {
        return match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }
}
