<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $user->outlet;
        abort_unless($outlet, 403);

        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $orders = Order::where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$from, $to]);

        $totalOrders = (clone $orders)->count();

        $orderIds = (clone $orders)->pluck('id');
        $itemStats = OrderItem::whereIn('order_id', $orderIds)
            ->selectRaw('COALESCE(SUM(subtotal), 0) as total_revenue, COALESCE(SUM(quantity), 0) as total_items')
            ->first();

        return Inertia::render('outlet/reports/index', [
            'outlet' => $outlet->only(['id', 'name']),
            'preview' => [
                'total_orders' => $totalOrders,
                'total_revenue' => (float) ($itemStats->total_revenue ?? 0),
                'total_items' => (int) ($itemStats->total_items ?? 0),
                'date_from' => $from->format('Y-m-d'),
                'date_to' => $to->format('Y-m-d'),
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $user = $request->user();
        $outlet = $user->outlet;
        abort_unless($outlet, 403);

        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $filename = 'laporan-penjualan-'.$from->format('Y-m-d').'-'.$to->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($outlet, $from, $to): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Tanggal', 'Order Code', 'Produk', 'Variant', 'Qty', 'Harga', 'Subtotal', 'Margin']);

            Order::where('outlet_id', $outlet->id)
                ->where('status', 'completed')
                ->whereBetween('completed_at', [$from, $to])
                ->with('items')
                ->latest('completed_at')
                ->chunk(200, function ($orders) use ($handle): void {
                    foreach ($orders as $order) {
                        foreach ($order->items as $item) {
                            $margin = (float) $item->outlet_margin_snapshot * $item->quantity;
                            fputcsv($handle, [
                                $order->completed_at->format('d/m/Y'),
                                $order->order_code,
                                $item->product_name,
                                $item->variant_name_snapshot,
                                $item->quantity,
                                $item->selling_price_snapshot,
                                $item->subtotal,
                                $margin,
                            ]);
                        }
                    }
                });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    private function resolvePeriod(string $period, Request $request): array
    {
        return match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            'custom' => $this->resolveCustomRange($request),
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }

    private function resolveCustomRange(Request $request): array
    {
        $from = $request->date('date_from') ?? now()->startOfDay();
        $to = $request->date('date_to') ?? $from->copy()->endOfDay();

        return [$from->startOfDay(), $to->endOfDay()];
    }
}
