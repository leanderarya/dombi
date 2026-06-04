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

        $courier = auth()->user();
        $capacityData = $intelligence->getCourierCapacity($courier);

        return Inertia::render('courier/dashboard', [
            'stats' => [
                'waitingPickup' => Delivery::where('courier_id', $courierId)->where('status', 'waiting_pickup')->count(),
                'pickedUp' => Delivery::where('courier_id', $courierId)->where('status', 'picked_up')->count(),
                'delivering' => Delivery::where('courier_id', $courierId)->where('status', 'delivering')->count(),
                'completedToday' => $completedToday,
                'failedToday' => $failedToday,
            ],
            'performance' => [
                'successRate' => $successRate,
                'avgDeliveryTime' => $avgDeliveryTime,
                'capacityStatus' => $capacityData['capacity_status'],
                'activeDeliveries' => $capacityData['active_deliveries'],
            ],
            'nextPickup' => Delivery::where('courier_id', $courierId)
                ->where('status', 'waiting_pickup')
                ->with(['order:id,order_code,customer_name,customer_address,outlet_id', 'order.outlet:id,name'])
                ->orderBy('assigned_at')
                ->first(),
            'activeDeliveries' => Delivery::where('courier_id', $courierId)
                ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
                ->with(['order:id,order_code,customer_name,customer_address,outlet_id', 'order.outlet:id,name'])
                ->latest()
                ->get(['id', 'order_id', 'status', 'assigned_at']),
        ]);
    }
}
