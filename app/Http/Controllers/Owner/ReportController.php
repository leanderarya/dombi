<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\RestockRequest;
use App\Models\Settlement;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $dateFrom = $request->date('date_from') ?? today()->subDays(7);
        $dateTo = $request->date('date_to') ?? today();
        $outletId = $request->integer('outlet_id') ?: null;

        $ordersQuery = Order::query()
            ->whereBetween('created_at', [$dateFrom->startOfDay(), $dateTo->endOfDay()])
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId));

        $deliveriesQuery = Delivery::query()
            ->whereBetween('created_at', [$dateFrom->startOfDay(), $dateTo->endOfDay()])
            ->when($outletId, fn ($q) => $q->whereHas('order', fn ($oq) => $oq->where('outlet_id', $outletId)));

        $movementsQuery = StockMovement::query()
            ->whereBetween('created_at', [$dateFrom->startOfDay(), $dateTo->endOfDay()])
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId));

        return Inertia::render('owner/reports/index', [
            'summary' => [
                'totalOrders' => (clone $ordersQuery)->count(),
                'totalRevenue' => Order::query()
                    ->whereBetween('completed_at', [$dateFrom->startOfDay(), $dateTo->endOfDay()])
                    ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
                    ->where('status', 'completed')
                    ->sum('total'),
                'completedOrders' => (clone $ordersQuery)->where('status', 'completed')->count(),
                'cancelledOrders' => (clone $ordersQuery)->whereIn('status', ['cancelled_by_customer', 'cancelled_by_outlet'])->count(),
                'cancelledByCustomer' => (clone $ordersQuery)->where('status', 'cancelled_by_customer')->count(),
                'cancelledByOutlet' => (clone $ordersQuery)->where('status', 'cancelled_by_outlet')->count(),
                'rejectedByOutlet' => (clone $ordersQuery)->where('status', 'rejected_by_outlet')->count(),
                'expiredOrders' => (clone $ordersQuery)->where('status', 'expired')->count(),
                'failedDeliveries' => (clone $deliveriesQuery)->where('status', 'failed')->count(),
                'completedDeliveries' => (clone $deliveriesQuery)->where('status', 'completed')->count(),
                'stockMovements' => (clone $movementsQuery)->count(),
                'restockRequests' => RestockRequest::query()
                    ->whereBetween('created_at', [$dateFrom->startOfDay(), $dateTo->endOfDay()])
                    ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
                    ->count(),
            ],
            'customerSummary' => [
                'totalCustomers' => Customer::count(),
                'guestCustomers' => Customer::where('is_registered', false)->count(),
                'registeredCustomers' => Customer::where('is_registered', true)->count(),
                'newCustomersInPeriod' => Customer::query()
                    ->whereBetween('created_at', [$dateFrom->startOfDay(), $dateTo->endOfDay()])
                    ->count(),
                'uniqueCustomersInPeriod' => Order::query()
                    ->whereBetween('created_at', [$dateFrom->startOfDay(), $dateTo->endOfDay()])
                    ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
                    ->distinct('customer_id')
                    ->count('customer_id'),
            ],
            'ordersByStatus' => (clone $ordersQuery)
                ->selectRaw('status, count(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status'),
            'deliveriesByStatus' => (clone $deliveriesQuery)
                ->selectRaw('status, count(*) as count')
                ->groupBy('status')
                ->pluck('count', 'status'),
            'outlets' => Outlet::orderBy('name')->get(['id', 'name']),
            'filters' => [
                'date_from' => $dateFrom->format('Y-m-d'),
                'date_to' => $dateTo->format('Y-m-d'),
                'outlet_id' => $outletId,
            ],
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $dateFrom = $request->date('date_from') ?? today()->subDays(7);
        $dateTo = $request->date('date_to') ?? today();
        $outletId = $request->integer('outlet_id') ?: null;

        $filename = 'orders-report-'.$dateFrom->format('Ymd').'-'.$dateTo->format('Ymd').'.csv';

        return response()->streamDownload(function () use ($dateFrom, $dateTo, $outletId): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Order Code', 'Customer', 'Outlet', 'Status', 'Total', 'Created At']);

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
                            $order->status,
                            $order->total,
                            $order->created_at->format('Y-m-d H:i'),
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
                    $order->total,
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
                    $s->amount_due,
                    $s->paid_amount,
                    $s->outstanding_amount,
                    $s->status,
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
