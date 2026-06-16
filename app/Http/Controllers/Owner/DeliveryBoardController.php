<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\DeliverySlaService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DeliveryBoardController extends Controller
{
    public function index(Request $request, DeliverySlaService $slaService): Response
    {
        $outletId = $request->integer('outlet_id') ?: null;
        $courierId = $request->integer('courier_id') ?: null;
        $dateRange = $request->string('date_range', 'today')->toString();

        $dateFilter = match ($dateRange) {
            'week' => now()->startOfWeek(),
            default => today(),
        };

        // Menunggu Kurir: orders ready_for_pickup without delivery
        $unassignedOrders = Order::query()
            ->where('status', 'ready_for_pickup')
            ->whereDoesntHave('delivery')
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->with(['outlet:id,name', 'items'])
            ->orderBy('updated_at')
            ->get()
            ->map(function (Order $order) use ($slaService): array {
                return [
                    'id' => $order->id,
                    'order_code' => $order->order_code,
                    'customer_name' => $order->customer_name,
                    'outlet' => $order->outlet,
                    'total' => $order->total,
                    'distance_km' => $order->delivery_distance_km,
                    'created_at' => $order->created_at->toIso8601String(),
                    'updated_at' => $order->updated_at->toIso8601String(),
                    'delivery_age' => $order->updated_at->diffInMinutes(now()),
                    'sla_health' => $slaService->getOrderSlaHealth($order),
                    'status' => 'waiting_assignment',
                    'type' => 'order',
                ];
            });

        // Ditugaskan: deliveries waiting_pickup
        $assignedDeliveries = Delivery::query()
            ->where('status', 'waiting_pickup')
            ->when($courierId, fn ($q) => $q->where('courier_id', $courierId))
            ->when($outletId, fn ($q) => $q->whereHas('order', fn ($q2) => $q2->where('outlet_id', $outletId)))
            ->with(['order.outlet:id,name', 'courier:id,name', 'order.items'])
            ->orderBy('assigned_at')
            ->get()
            ->map(fn (Delivery $d) => $this->formatDelivery($d, $slaService));

        // Dalam Perjalanan: picked_up + delivering
        $inTransitDeliveries = Delivery::query()
            ->whereIn('status', ['picked_up', 'delivering'])
            ->when($courierId, fn ($q) => $q->where('courier_id', $courierId))
            ->when($outletId, fn ($q) => $q->whereHas('order', fn ($q2) => $q2->where('outlet_id', $outletId)))
            ->with(['order.outlet:id,name', 'courier:id,name', 'order.items'])
            ->orderBy('pickup_time')
            ->get()
            ->map(fn (Delivery $d) => $this->formatDelivery($d, $slaService));

        // Perlu Tindakan: failed, retry_delivery, returned_to_outlet
        $needsActionDeliveries = Delivery::query()
            ->whereIn('status', ['failed', 'retry_delivery', 'returned_to_outlet'])
            ->when($courierId, fn ($q) => $q->where('courier_id', $courierId))
            ->when($outletId, fn ($q) => $q->whereHas('order', fn ($q2) => $q2->where('outlet_id', $outletId)))
            ->with(['order.outlet:id,name', 'courier:id,name', 'order.items'])
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(fn (Delivery $d) => $this->formatDelivery($d, $slaService));

        // Selesai: completed today
        $completedDeliveries = Delivery::query()
            ->where('status', 'completed')
            ->where('updated_at', '>=', $dateFilter)
            ->when($courierId, fn ($q) => $q->where('courier_id', $courierId))
            ->when($outletId, fn ($q) => $q->whereHas('order', fn ($q2) => $q2->where('outlet_id', $outletId)))
            ->with(['order.outlet:id,name', 'courier:id,name'])
            ->orderBy('delivered_time', 'desc')
            ->limit(50)
            ->get()
            ->map(fn (Delivery $d) => $this->formatDelivery($d, $slaService));

        // Couriers with availability
        $couriers = User::where('role', 'courier')
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(function (User $courier): array {
                $activeCount = Delivery::where('courier_id', $courier->id)
                    ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
                    ->count();

                return [
                    'id' => $courier->id,
                    'name' => $courier->name,
                    'active_deliveries' => $activeCount,
                ];
            });

        // Performance stats
        $todayStart = today();
        $completedToday = Delivery::where('status', 'completed')->where('updated_at', '>=', $todayStart)->count();
        $failedToday = Delivery::where('status', 'failed')->where('updated_at', '>=', $todayStart)->count();
        $totalToday = $completedToday + $failedToday;
        $avgDeliveryTime = Delivery::where('status', 'completed')
            ->where('updated_at', '>=', $todayStart)
            ->whereNotNull('pickup_time')
            ->whereNotNull('delivered_time')
            ->get()
            ->avg(fn (Delivery $d) => $d->pickup_time->diffInMinutes($d->delivered_time));

        return Inertia::render('owner/deliveries/board', [
            'board' => [
                'unassigned' => $unassignedOrders->values(),
                'assigned' => $assignedDeliveries->values(),
                'inTransit' => $inTransitDeliveries->values(),
                'needsAction' => $needsActionDeliveries->values(),
                'completed' => $completedDeliveries->values(),
            ],
            'stats' => [
                'unassigned' => $unassignedOrders->count(),
                'assigned' => $assignedDeliveries->count(),
                'inTransit' => $inTransitDeliveries->count(),
                'needsAction' => $needsActionDeliveries->count(),
                'completed' => $completedToday,
                'failed' => $failedToday,
                'successRate' => $totalToday > 0 ? round(($completedToday / $totalToday) * 100) : 0,
                'avgDeliveryTime' => round($avgDeliveryTime ?? 0),
                'overdue' => $slaService->countOverdue(),
            ],
            'couriers' => $couriers,
            'filters' => [
                'outlet_id' => $outletId,
                'courier_id' => $courierId,
                'date_range' => $dateRange,
            ],
            'outlets' => Outlet::where('status', 'active')->orderBy('name')->get(['id', 'name']),
        ]);
    }

    private function formatDelivery(Delivery $d, DeliverySlaService $slaService): array
    {
        return [
            'id' => $d->id,
            'order_code' => $d->order->order_code,
            'customer_name' => $d->order->customer_name,
            'outlet' => $d->order->outlet,
            'courier' => $d->courier,
            'total' => $d->order->total,
            'distance_km' => $d->order->delivery_distance_km,
            'status' => $d->status,
            'assigned_at' => $d->assigned_at?->toIso8601String(),
            'pickup_time' => $d->pickup_time?->toIso8601String(),
            'delivered_time' => $d->delivered_time?->toIso8601String(),
            'failed_reason' => $d->failed_reason,
            'delivery_age' => $d->assigned_at ? $d->assigned_at->diffInMinutes(now()) : null,
            'sla_health' => $slaService->getSlaHealth($d),
            'type' => 'delivery',
        ];
    }
}
