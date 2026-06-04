<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use App\Services\DeliveryIntelligenceService;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(DeliveryIntelligenceService $intelligence): Response
    {
        $courierId = auth()->id();
        $courier = auth()->user();
        $todayStart = today();

        $completedToday = Delivery::where('courier_id', $courierId)
            ->where('status', 'completed')
            ->whereDate('updated_at', $todayStart)
            ->count();

        $failedToday = Delivery::where('courier_id', $courierId)
            ->where('status', 'failed')
            ->whereDate('updated_at', $todayStart)
            ->count();

        $totalToday = $completedToday + $failedToday;
        $successRate = $totalToday > 0 ? round(($completedToday / $totalToday) * 100, 1) : 0;

        $completedDeliveries = Delivery::where('courier_id', $courierId)
            ->where('status', 'completed')
            ->whereNotNull('pickup_time')
            ->whereNotNull('delivered_time')
            ->whereDate('updated_at', $todayStart)
            ->get(['pickup_time', 'delivered_time']);

        $avgDeliveryTime = null;
        if ($completedDeliveries->isNotEmpty()) {
            $totalMinutes = $completedDeliveries->sum(fn (Delivery $d) => (int) $d->pickup_time->diffInMinutes($d->delivered_time));
            $avgDeliveryTime = (int) round($totalMinutes / $completedDeliveries->count());
        }

        $capacityData = $intelligence->getCourierCapacity($courier);

        // Task-focused sections
        $waitingPickup = Delivery::where('courier_id', $courierId)
            ->where('status', 'waiting_pickup')
            ->with(['order:id,order_code,customer_name,customer_phone,customer_address,customer_address_detail,customer_landmark,latitude,longitude,outlet_id,notes', 'order.outlet:id,name,address,latitude,longitude,phone'])
            ->orderBy('assigned_at')
            ->get(['id', 'order_id', 'status', 'assigned_at', 'notes']);

        $inTransit = Delivery::where('courier_id', $courierId)
            ->whereIn('status', ['picked_up', 'delivering'])
            ->with(['order:id,order_code,customer_name,customer_phone,customer_address,customer_address_detail,customer_landmark,latitude,longitude,outlet_id,notes', 'order.outlet:id,name,address,latitude,longitude,phone'])
            ->orderBy('pickup_time')
            ->get(['id', 'order_id', 'status', 'assigned_at', 'pickup_time', 'notes']);

        $failedDeliveries = Delivery::where('courier_id', $courierId)
            ->where('status', 'failed')
            ->with(['order:id,order_code,customer_name,outlet_id', 'order.outlet:id,name'])
            ->orderBy('updated_at', 'desc')
            ->limit(5)
            ->get(['id', 'order_id', 'status', 'failed_reason', 'updated_at']);

        $completedTodayList = Delivery::where('courier_id', $courierId)
            ->where('status', 'completed')
            ->whereDate('updated_at', $todayStart)
            ->with(['order:id,order_code,customer_name,outlet_id', 'order.outlet:id,name'])
            ->orderBy('delivered_time', 'desc')
            ->limit(10)
            ->get(['id', 'order_id', 'status', 'delivered_time', 'delivered_to']);

        return Inertia::render('courier/dashboard', [
            'courier' => [
                'id' => $courier->id,
                'name' => $courier->name,
                'is_online' => $courier->is_online,
                'is_on_shift' => $courier->isOnShift(),
                'shift_started_at' => $courier->shift_started_at?->toISOString(),
            ],
            'stats' => [
                'waitingPickup' => $waitingPickup->count(),
                'inTransit' => $inTransit->count(),
                'completedToday' => $completedToday,
                'failedToday' => $failedToday,
            ],
            'performance' => [
                'successRate' => $successRate,
                'avgDeliveryTime' => $avgDeliveryTime,
                'capacityStatus' => $capacityData['capacity_status'],
                'activeDeliveries' => $capacityData['active_deliveries'],
            ],
            'tasks' => [
                'waitingPickup' => $waitingPickup->map(fn (Delivery $d) => [
                    'id' => $d->id,
                    'order_code' => $d->order->order_code,
                    'customer_name' => $d->order->customer_name,
                    'customer_address' => $d->order->customer_address,
                    'outlet_name' => $d->order->outlet?->name,
                    'assigned_at' => $d->assigned_at?->toISOString(),
                    'age_minutes' => $d->assigned_at ? (int) $d->assigned_at->diffInMinutes(now()) : 0,
                ]),
                'inTransit' => $inTransit->map(fn (Delivery $d) => [
                    'id' => $d->id,
                    'order_code' => $d->order->order_code,
                    'customer_name' => $d->order->customer_name,
                    'customer_address' => $d->order->customer_address,
                    'outlet_name' => $d->order->outlet?->name,
                    'status' => $d->status,
                    'pickup_time' => $d->pickup_time?->toISOString(),
                ]),
                'needsAction' => $failedDeliveries->map(fn (Delivery $d) => [
                    'id' => $d->id,
                    'order_code' => $d->order->order_code,
                    'customer_name' => $d->order->customer_name,
                    'failed_reason' => $d->failed_reason,
                    'updated_at' => $d->updated_at?->toISOString(),
                ]),
                'completedToday' => $completedTodayList->map(fn (Delivery $d) => [
                    'id' => $d->id,
                    'order_code' => $d->order->order_code,
                    'customer_name' => $d->order->customer_name,
                    'delivered_time' => $d->delivered_time?->toISOString(),
                    'delivered_to' => $d->delivered_to,
                ]),
            ],
        ]);
    }
}
