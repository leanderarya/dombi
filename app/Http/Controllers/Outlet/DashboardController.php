<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\ExchangeRequest;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\OutletInventory;
use App\Models\RestockRequest;
use App\Models\ReturnRequest;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Services\DeliveryIntelligenceService;
use App\Services\SettlementReconciliationService;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(DeliveryIntelligenceService $intelligence, SettlementReconciliationService $reconciliationService): Response
    {
        $outlet = auth()->user()->outlet;
        abort_unless($outlet, 403);

        $outletDeliveries = Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id));

        $reconciliation = $reconciliationService->getOutletReconciliation($outlet->id);

        // Payment gate — applied to all order queries so dashboard counts match the visible order list.
        // Outlet sees only paid orders.
        $visibleOrders = fn ($q) => $q
            ->where('outlet_id', $outlet->id)
            ->where('payment_status', 'paid');

        $stats = [
            'pendingOrders' => (clone $visibleOrders(Order::query()))
                ->where('status', 'pending_confirmation')
                ->where(function ($q) {
                    $q->whereNull('confirmation_expires_at')
                        ->orWhere('confirmation_expires_at', '>', now());
                })
                ->count(),
            'preparingOrders' => (clone $visibleOrders(Order::query()))->where('status', 'preparing')->count(),
            'readyForCustomerPickup' => (clone $visibleOrders(Order::query()))->where('status', Order::STATUS_READY_FOR_PICKUP)->where('fulfillment_type', Order::FULFILLMENT_PICKUP)->count(),
            'todayOrders' => (clone $visibleOrders(Order::query()))->whereDate('created_at', today())->count(),
            'expiredToday' => Order::where('outlet_id', $outlet->id)
                ->where('status', 'expired')
                ->whereDate('expired_at', today())
                ->count(),
            'lowStocks' => OutletInventory::where('outlet_id', $outlet->id)
                ->whereRaw('(current_stock - reserved_stock) <= minimum_stock')
                ->count(),
            'pendingRestocks' => RestockRequest::where('outlet_id', $outlet->id)
                ->whereIn('status', ['requested', 'preparing', 'shipped'])
                ->count(),
            'pendingReturns' => ReturnRequest::where('outlet_id', $outlet->id)
                ->whereIn('status', ['submitted', 'approved'])
                ->count(),
            'pendingExchanges' => ExchangeRequest::where('outlet_id', $outlet->id)
                ->whereIn('status', ['submitted', 'approved', 'preparing', 'shipped'])
                ->count(),
            'returnValue' => ReturnRequest::where('outlet_id', $outlet->id)
                ->whereIn('status', ['submitted', 'approved', 'received_at_center'])
                ->sum('total_value'),
            'exchangeValue' => ExchangeRequest::where('outlet_id', $outlet->id)
                ->whereIn('status', ['submitted', 'approved', 'preparing', 'shipped'])
                ->sum('exchange_value'),
        ];

        $deliveryStats = [
            'needsDispatch' => (clone $visibleOrders(Order::query()))->where('status', Order::STATUS_READY_FOR_PICKUP)->whereIn('fulfillment_type', Order::DELIVERY_FULFILLMENT_TYPES)->whereDoesntHave('delivery')->count(),
            'waitingPickup' => (clone $outletDeliveries)->where('status', 'waiting_pickup')->count(),
            'inTransit' => (clone $outletDeliveries)->whereIn('status', ['picked_up', 'delivering'])->count(),
            'failed' => (clone $outletDeliveries)->where('status', 'failed')->count(),
            'completedToday' => (clone $outletDeliveries)->where('status', 'completed')->whereDate('updated_at', today())->count(),
            'avgDispatchTime' => $this->avgDispatchTime($outlet->id),
        ];

        $hour = now()->hour;
        $greeting = match (true) {
            $hour < 12 => 'Selamat Pagi',
            $hour < 17 => 'Selamat Siang',
            default => 'Selamat Malam',
        };

        $pendingTasks = $stats['pendingOrders']
            + $deliveryStats['failed']
            + $stats['lowStocks'];

        $orderQueue = [
            'new' => $stats['pendingOrders'],
            'preparing' => $stats['preparingOrders'],
            'ready' => $stats['readyForCustomerPickup'],
            'waiting_courier' => Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))
                ->where('status', 'waiting_pickup')
                ->count(),
        ];

        return Inertia::render('outlet/dashboard', [
            'outlet' => $outlet,
            'stats' => $stats,
            'lowStockItems' => OutletInventory::with('product:id,name,unit')
                ->where('outlet_id', $outlet->id)
                ->whereRaw('(current_stock - reserved_stock) <= minimum_stock')
                ->get(['id', 'product_id', 'current_stock', 'reserved_stock', 'minimum_stock']),
            'deliveryStats' => $deliveryStats,
            'greeting' => $greeting,
            'pendingTasks' => $pendingTasks,
            'orderQueue' => $orderQueue,
            'failureReasons' => (clone $outletDeliveries)
                ->where('status', 'failed')
                ->whereNotNull('failed_reason')
                ->select('failed_reason', DB::raw('COUNT(*) as count'))
                ->groupBy('failed_reason')
                ->orderByDesc('count')
                ->limit(3)
                ->get()
                ->map(fn ($item) => ['reason' => $item->failed_reason, 'count' => $item->count]),
            'recentOrders' => (clone $visibleOrders(Order::query()))
                ->whereIn('status', ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup'])
                ->latest()
                ->limit(5)
                ->get(['id', 'order_code', 'status', 'customer_name', 'total', 'created_at']),
            'settlementStats' => [
                'outstanding' => (float) $reconciliation['outstanding'],
                'pendingPayments' => (float) $reconciliation['pending_payments'],
                'verifiedPayments' => (float) $reconciliation['verified_payments'],
                'margin' => (float) Settlement::where('outlet_id', $outlet->id)
                    ->where('period_type', 'weekly')
                    ->whereMonth('period_start', now()->month)
                    ->whereYear('period_start', now()->year)
                    ->sum(DB::raw('sales_amount - amount_due')),
            ],
        ]);
    }

    public function badgeCounts(): array
    {
        $outlet = auth()->user()->outlet;
        abort_unless($outlet, 403);

        return [
            'returns' => ReturnRequest::where('outlet_id', $outlet->id)
                ->whereIn('status', ['submitted', 'approved'])
                ->count(),
            'exchanges' => ExchangeRequest::where('outlet_id', $outlet->id)
                ->whereIn('status', ['submitted', 'approved', 'preparing', 'shipped'])
                ->count(),
            'restocks' => RestockRequest::where('outlet_id', $outlet->id)
                ->whereIn('status', ['requested', 'preparing', 'shipped'])
                ->count(),
            'deliveries' => Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))
                ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
                ->count(),
            'payments' => SettlementPayment::where('outlet_id', $outlet->id)
                ->where('status', SettlementPayment::STATUS_PENDING)
                ->count(),
            'reports' => OrderReport::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))
                ->active()
                ->count(),
        ];
    }

    private function avgDispatchTime(int $outletId): ?int
    {
        $orders = Order::where('outlet_id', $outletId)
            ->whereHas('delivery')
            ->whereDate('updated_at', today())
            ->with('delivery')
            ->get();

        if ($orders->isEmpty()) {
            return null;
        }

        $times = $orders->map(function (Order $o): ?int {
            if (! $o->delivery || ! $o->delivery->assigned_at) {
                return null;
            }

            return (int) $o->updated_at->diffInMinutes($o->delivery->assigned_at);
        })->filter();

        return $times->isNotEmpty() ? (int) round($times->avg()) : null;
    }
}
