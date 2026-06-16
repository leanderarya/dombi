<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Order;

class DeliverySlaService
{
    public function getAssignmentSlaMinutes(): int
    {
        return config('delivery.sla.assignment_sla_minutes', 10);
    }

    public function getPickupSlaMinutes(): int
    {
        return config('delivery.sla.pickup_sla_minutes', 20);
    }

    public function getDeliverySlaMinutes(): int
    {
        return config('delivery.sla.delivery_sla_minutes', 60);
    }

    /**
     * Calculate SLA health for an order waiting for courier assignment.
     */
    public function getAssignmentSlaHealth(Order $order): string
    {
        if ($order->status !== 'ready_for_pickup') {
            return 'normal';
        }

        $elapsed = $order->updated_at->diffInMinutes(now());
        $sla = $this->getAssignmentSlaMinutes();

        return $this->healthFromElapsed($elapsed, $sla);
    }

    /**
     * Calculate SLA health for a delivery in waiting_pickup status.
     */
    public function getPickupSlaHealth(Delivery $delivery): string
    {
        if ($delivery->status !== 'waiting_pickup') {
            return 'normal';
        }

        $elapsed = $delivery->assigned_at?->diffInMinutes(now()) ?? 0;
        $sla = $this->getPickupSlaMinutes();

        return $this->healthFromElapsed($elapsed, $sla);
    }

    /**
     * Calculate SLA health for a delivery in picked_up or delivering status.
     */
    public function getDeliverySlaHealth(Delivery $delivery): string
    {
        if (! in_array($delivery->status, ['picked_up', 'delivering'], true)) {
            return 'normal';
        }

        $startTime = $delivery->pickup_time ?? $delivery->assigned_at;
        if (! $startTime) {
            return 'normal';
        }

        $elapsed = $startTime->diffInMinutes(now());
        $sla = $this->getDeliverySlaMinutes();

        return $this->healthFromElapsed($elapsed, $sla);
    }

    /**
     * Get overall SLA health for a delivery based on its current status.
     */
    public function getSlaHealth(Delivery $delivery): string
    {
        return match ($delivery->status) {
            'waiting_pickup' => $this->getPickupSlaHealth($delivery),
            'picked_up', 'delivering' => $this->getDeliverySlaHealth($delivery),
            default => 'normal',
        };
    }

    /**
     * Get SLA health for an order that needs assignment.
     */
    public function getOrderSlaHealth(Order $order): string
    {
        if ($order->status === 'ready_for_pickup' && ! $order->delivery) {
            return $this->getAssignmentSlaHealth($order);
        }

        return 'normal';
    }

    /**
     * Check if assignment SLA is exceeded.
     */
    public function isAssignmentOverdue(Order $order): bool
    {
        return $this->getAssignmentSlaHealth($order) === 'critical';
    }

    /**
     * Check if pickup SLA is exceeded.
     */
    public function isPickupOverdue(Delivery $delivery): bool
    {
        return $this->getPickupSlaHealth($delivery) === 'critical';
    }

    /**
     * Check if delivery SLA is exceeded.
     */
    public function isDeliveryOverdue(Delivery $delivery): bool
    {
        return $this->getDeliverySlaHealth($delivery) === 'critical';
    }

    /**
     * Count deliveries/orders that are overdue (SLA exceeded).
     */
    public function countOverdue(): int
    {
        $overdueAssignments = Order::where('status', 'ready_for_pickup')
            ->whereDoesntHave('delivery')
            ->where('updated_at', '<', now()->subMinutes($this->getAssignmentSlaMinutes()))
            ->count();

        $overduePickups = Delivery::where('status', 'waiting_pickup')
            ->where('assigned_at', '<', now()->subMinutes($this->getPickupSlaMinutes()))
            ->count();

        $overdueDeliveries = Delivery::whereIn('status', ['picked_up', 'delivering'])
            ->where(function ($query): void {
                $query->where('pickup_time', '<', now()->subMinutes($this->getDeliverySlaMinutes()))
                    ->orWhere(function ($q): void {
                        $q->whereNull('pickup_time')
                            ->where('assigned_at', '<', now()->subMinutes($this->getDeliverySlaMinutes()));
                    });
            })
            ->count();

        return $overdueAssignments + $overduePickups + $overdueDeliveries;
    }

    private function healthFromElapsed(int $elapsed, int $sla): string
    {
        if ($elapsed >= $sla) {
            return 'critical';
        }

        if ($elapsed >= ($sla * 0.8)) {
            return 'warning';
        }

        return 'normal';
    }
}
