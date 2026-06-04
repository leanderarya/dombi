<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\DeliveryResolutionLog;
use App\Models\DeliveryStatusHistory;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DeliveryIntelligenceService
{
    public function __construct(
        private readonly DeliverySlaService $slaService,
    ) {}

    // ─── COURIER CAPACITY ──────────────────────────────────────────

    /**
     * Get capacity status for a courier.
     */
    public function getCourierCapacity(User $courier): array
    {
        $activeCount = Delivery::where('courier_id', $courier->id)
            ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->count();

        return [
            'id' => $courier->id,
            'name' => $courier->name,
            'active_deliveries' => $activeCount,
            'capacity_status' => $this->capacityStatus($activeCount),
            'today_completed' => $this->courierTodayCompleted($courier),
            'today_failed' => $this->courierTodayFailed($courier),
            'avg_delivery_time' => $this->courierAvgDeliveryTime($courier),
        ];
    }

    /**
     * Get all couriers with capacity data.
     */
    public function getAllCouriersCapacity(): Collection
    {
        return User::where('role', 'courier')
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (User $courier) => $this->getCourierCapacity($courier));
    }

    /**
     * Get capacity status label from active count.
     */
    public function capacityStatus(int $activeCount): string
    {
        if ($activeCount >= 5) {
            return 'overloaded';
        }

        if ($activeCount >= 3) {
            return 'busy';
        }

        return 'available';
    }

    private function courierTodayCompleted(User $courier): int
    {
        return Delivery::where('courier_id', $courier->id)
            ->where('status', 'completed')
            ->whereDate('updated_at', today())
            ->count();
    }

    private function courierTodayFailed(User $courier): int
    {
        return Delivery::where('courier_id', $courier->id)
            ->where('status', 'failed')
            ->whereDate('updated_at', today())
            ->count();
    }

    private function courierAvgDeliveryTime(User $courier): ?int
    {
        $deliveries = Delivery::where('courier_id', $courier->id)
            ->where('status', 'completed')
            ->whereNotNull('pickup_time')
            ->whereNotNull('delivered_time')
            ->whereDate('updated_at', today())
            ->get(['pickup_time', 'delivered_time']);

        if ($deliveries->isEmpty()) {
            return null;
        }

        $totalMinutes = $deliveries->sum(function (Delivery $d): int {
            return (int) $d->pickup_time->diffInMinutes($d->delivered_time);
        });

        return (int) round($totalMinutes / $deliveries->count());
    }

    // ─── DELIVERY AGING ────────────────────────────────────────────

    /**
     * Get oldest active deliveries sorted by age descending.
     */
    public function getOldestDeliveries(int $limit = 10): Collection
    {
        return Delivery::whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->with(['order:id,order_code,customer_name,outlet_id', 'order.outlet:id,name', 'courier:id,name'])
            ->get()
            ->map(function (Delivery $d): array {
                $startTime = $d->assigned_at ?? $d->created_at;
                $ageMinutes = $startTime ? (int) $startTime->diffInMinutes(now()) : 0;

                return [
                    'id' => $d->id,
                    'order_code' => $d->order->order_code,
                    'courier' => $d->courier?->name ?? '-',
                    'outlet' => $d->order->outlet?->name ?? '-',
                    'age_minutes' => $ageMinutes,
                    'status' => $d->status,
                    'sla_health' => $this->slaService->getSlaHealth($d),
                ];
            })
            ->sortByDesc('age_minutes')
            ->take($limit)
            ->values();
    }

    // ─── SLA VIOLATIONS ────────────────────────────────────────────

    /**
     * Get SLA violations grouped by category.
     */
    public function getSlaViolations(): array
    {
        $assignmentSla = $this->slaService->getAssignmentSlaMinutes();
        $pickupSla = $this->slaService->getPickupSlaMinutes();
        $deliverySla = $this->slaService->getDeliverySlaMinutes();

        // Assignment violations: orders waiting too long for courier
        $assignmentViolations = Order::where('status', 'ready_for_pickup')
            ->whereDoesntHave('delivery')
            ->where('updated_at', '<', now()->subMinutes($assignmentSla))
            ->with('outlet:id,name')
            ->get()
            ->map(fn (Order $o) => [
                'order_code' => $o->order_code,
                'outlet' => $o->outlet?->name ?? '-',
                'age_minutes' => (int) $o->updated_at->diffInMinutes(now()),
            ]);

        // Pickup violations: deliveries waiting too long for pickup
        $pickupViolations = Delivery::where('status', 'waiting_pickup')
            ->where('assigned_at', '<', now()->subMinutes($pickupSla))
            ->with(['courier:id,name', 'order.outlet:id,name'])
            ->get()
            ->map(fn (Delivery $d) => [
                'order_code' => $d->order->order_code,
                'courier' => $d->courier?->name ?? '-',
                'outlet' => $d->order->outlet?->name ?? '-',
                'age_minutes' => (int) ($d->assigned_at?->diffInMinutes(now()) ?? 0),
            ]);

        // Delivery violations: deliveries taking too long
        $deliveryViolations = Delivery::whereIn('status', ['picked_up', 'delivering'])
            ->where(function ($q) use ($deliverySla): void {
                $q->where('pickup_time', '<', now()->subMinutes($deliverySla))
                    ->orWhere(function ($q2) use ($deliverySla): void {
                        $q2->whereNull('pickup_time')
                            ->where('assigned_at', '<', now()->subMinutes($deliverySla));
                    });
            })
            ->with(['courier:id,name', 'order.outlet:id,name'])
            ->get()
            ->map(function (Delivery $d) use ($deliverySla): array {
                $startTime = $d->pickup_time ?? $d->assigned_at;

                return [
                    'order_code' => $d->order->order_code,
                    'courier' => $d->courier?->name ?? '-',
                    'outlet' => $d->order->outlet?->name ?? '-',
                    'age_minutes' => $startTime ? (int) $startTime->diffInMinutes(now()) : 0,
                ];
            });

        return [
            'assignment' => [
                'count' => $assignmentViolations->count(),
                'items' => $assignmentViolations->values(),
            ],
            'pickup' => [
                'count' => $pickupViolations->count(),
                'items' => $pickupViolations->values(),
            ],
            'delivery' => [
                'count' => $deliveryViolations->count(),
                'items' => $deliveryViolations->values(),
            ],
            'total' => $assignmentViolations->count() + $pickupViolations->count() + $deliveryViolations->count(),
        ];
    }

    // ─── RETRY TRACKING ────────────────────────────────────────────

    /**
     * Get retry count for a delivery based on order history.
     */
    public function getRetryCount(int $orderId): int
    {
        return DeliveryResolutionLog::where('order_id', $orderId)
            ->where('resolution_type', 'retry_delivery')
            ->count();
    }

    /**
     * Get deliveries with high retry counts.
     */
    public function getHighRetryDeliveries(int $minRetries = 2): Collection
    {
        return DeliveryResolutionLog::select('order_id', DB::raw('COUNT(*) as retry_count'))
            ->where('resolution_type', 'retry_delivery')
            ->groupBy('order_id')
            ->having('retry_count', '>=', $minRetries)
            ->with(['order:id,order_code,customer_name', 'order.outlet:id,name'])
            ->get()
            ->map(fn (DeliveryResolutionLog $log) => [
                'order_id' => $log->order_id,
                'order_code' => $log->order->order_code,
                'customer_name' => $log->order->customer_name,
                'outlet' => $log->order->outlet?->name ?? '-',
                'retry_count' => $log->retry_count,
            ]);
    }

    // ─── FAILURE INTELLIGENCE ──────────────────────────────────────

    /**
     * Get top failure reasons with counts.
     */
    public function getTopFailureReasons(int $limit = 5): Collection
    {
        return Delivery::where('status', 'failed')
            ->whereNotNull('failed_reason')
            ->select('failed_reason', DB::raw('COUNT(*) as count'))
            ->groupBy('failed_reason')
            ->orderByDesc('count')
            ->limit($limit)
            ->get()
            ->map(fn ($item) => [
                'reason' => $item->failed_reason,
                'count' => $item->count,
            ]);
    }

    /**
     * Get failure rate for a specific courier.
     */
    public function getCourierFailureRate(User $courier): float
    {
        $total = Delivery::where('courier_id', $courier->id)
            ->whereIn('status', ['completed', 'failed'])
            ->whereDate('updated_at', today())
            ->count();

        if ($total === 0) {
            return 0;
        }

        $failed = Delivery::where('courier_id', $courier->id)
            ->where('status', 'failed')
            ->whereDate('updated_at', today())
            ->count();

        return round(($failed / $total) * 100, 1);
    }

    // ─── COURIER LEADERBOARD ───────────────────────────────────────

    /**
     * Get courier leaderboard for today.
     */
    public function getCourierLeaderboard(int $limit = 10): Collection
    {
        return User::where('role', 'courier')
            ->where('is_active', true)
            ->get()
            ->map(function (User $courier): array {
                $completed = $this->courierTodayCompleted($courier);
                $failed = $this->courierTodayFailed($courier);
                $total = $completed + $failed;
                $successRate = $total > 0 ? round(($completed / $total) * 100, 1) : 0;
                $avgTime = $this->courierAvgDeliveryTime($courier);

                return [
                    'id' => $courier->id,
                    'name' => $courier->name,
                    'completed' => $completed,
                    'failed' => $failed,
                    'success_rate' => $successRate,
                    'avg_delivery_time' => $avgTime,
                    'score' => $this->calculateCourierScore($completed, $successRate, $avgTime),
                ];
            })
            ->sortByDesc('score')
            ->take($limit)
            ->values();
    }

    private function calculateCourierScore(int $completed, float $successRate, ?int $avgTime): float
    {
        $score = $completed * 10;
        $score += $successRate * 0.5;

        if ($avgTime !== null && $avgTime > 0) {
            $score -= min(50, $avgTime * 0.5);
        }

        return round($score, 1);
    }

    // ─── OUTLET PERFORMANCE ────────────────────────────────────────

    /**
     * Get outlet delivery performance metrics.
     */
    public function getOutletPerformance(): Collection
    {
        return \App\Models\Outlet::where('status', 'active')
            ->get()
            ->map(function (\App\Models\Outlet $outlet): array {
                $deliveries = Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))
                    ->whereDate('updated_at', today())
                    ->get();

                $completed = $deliveries->where('status', 'completed');
                $failed = $deliveries->where('status', 'failed');
                $total = $completed->count() + $failed->count();

                return [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                    'total_deliveries' => $total,
                    'completed' => $completed->count(),
                    'failed' => $failed->count(),
                    'failure_rate' => $total > 0 ? round(($failed->count() / $total) * 100, 1) : 0,
                    'avg_assignment_time' => $this->outletAvgAssignmentTime($outlet),
                    'avg_pickup_time' => $this->outletAvgPickupTime($outlet),
                    'avg_delivery_time' => $this->outletAvgDeliveryTime($outlet),
                ];
            })
            ->sortByDesc('total_deliveries')
            ->values();
    }

    private function outletAvgAssignmentTime(\App\Models\Outlet $outlet): ?int
    {
        $orders = Order::where('outlet_id', $outlet->id)
            ->where('status', '!=', 'pending_confirmation')
            ->whereHas('delivery')
            ->whereDate('updated_at', today())
            ->with('delivery')
            ->get();

        if ($orders->isEmpty()) {
            return null;
        }

        $times = $orders->map(function (Order $o): ?int {
            if (!$o->delivery || !$o->delivery->assigned_at) {
                return null;
            }

            return (int) $o->updated_at->diffInMinutes($o->delivery->assigned_at);
        })->filter();

        return $times->isNotEmpty() ? (int) round($times->avg()) : null;
    }

    private function outletAvgPickupTime(\App\Models\Outlet $outlet): ?int
    {
        $deliveries = Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))
            ->where('status', 'completed')
            ->whereNotNull('pickup_time')
            ->whereDate('updated_at', today())
            ->get();

        if ($deliveries->isEmpty()) {
            return null;
        }

        $times = $deliveries->map(function (Delivery $d): ?int {
            if (!$d->assigned_at || !$d->pickup_time) {
                return null;
            }

            return (int) $d->assigned_at->diffInMinutes($d->pickup_time);
        })->filter();

        return $times->isNotEmpty() ? (int) round($times->avg()) : null;
    }

    private function outletAvgDeliveryTime(\App\Models\Outlet $outlet): ?int
    {
        $deliveries = Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))
            ->where('status', 'completed')
            ->whereNotNull('pickup_time')
            ->whereNotNull('delivered_time')
            ->whereDate('updated_at', today())
            ->get();

        if ($deliveries->isEmpty()) {
            return null;
        }

        $times = $deliveries->map(fn (Delivery $d) => (int) $d->pickup_time->diffInMinutes($d->delivered_time));

        return (int) round($times->avg());
    }

    // ─── DELIVERY HEALTH SCORE ─────────────────────────────────────

    /**
     * Calculate overall delivery health score.
     */
    public function getHealthScore(): array
    {
        $slaViolations = $this->getSlaViolations();
        $failedToday = Delivery::where('status', 'failed')->whereDate('updated_at', today())->count();
        $completedToday = Delivery::where('status', 'completed')->whereDate('updated_at', today())->count();
        $overloadedCouriers = $this->getAllCouriersCapacity()->filter(fn ($c) => $c['capacity_status'] === 'overloaded')->count();
        $highRetryCount = $this->getHighRetryDeliveries(2)->count();

        // Calculate score (0-100)
        $score = 100;

        // SLA violations: -5 per violation, max -30
        $score -= min(30, $slaViolations['total'] * 5);

        // Failed deliveries: -3 per failure, max -25
        $score -= min(25, $failedToday * 3);

        // Overloaded couriers: -10 per overloaded courier, max -20
        $score -= min(20, $overloadedCouriers * 10);

        // High retry deliveries: -5 per high-retry delivery, max -15
        $score -= min(15, $highRetryCount * 5);

        // Completed deliveries bonus: +1 per 5 completed, max +10
        $score += min(10, intdiv($completedToday, 5));

        $score = max(0, min(100, $score));

        return [
            'score' => $score,
            'status' => $this->healthStatus($score),
            'factors' => [
                'sla_violations' => $slaViolations['total'],
                'failed_deliveries' => $failedToday,
                'overloaded_couriers' => $overloadedCouriers,
                'high_retry_deliveries' => $highRetryCount,
                'completed_today' => $completedToday,
            ],
        ];
    }

    private function healthStatus(int $score): string
    {
        if ($score >= 90) {
            return 'excellent';
        }

        if ($score >= 70) {
            return 'good';
        }

        if ($score >= 50) {
            return 'needs_attention';
        }

        return 'critical';
    }
}
