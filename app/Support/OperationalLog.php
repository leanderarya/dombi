<?php

namespace App\Support;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Centralized operational logging helper.
 * Provides structured context for all operational events.
 */
class OperationalLog
{
    public static function stockAdjustment(int $outletId, int $productId, int $before, int $after, ?string $reason = null): void
    {
        Log::channel('operational')->info('Stock adjusted', [
            'event' => 'stock_adjustment',
            'outlet_id' => $outletId,
            'product_id' => $productId,
            'before_stock' => $before,
            'after_stock' => $after,
            'reason' => $reason,
            'actor_id' => Auth::id(),
        ]);
    }

    public static function deliveryFailed(int $deliveryId, int $orderId, int $courierId, string $reason): void
    {
        Log::channel('operational')->warning('Delivery failed', [
            'event' => 'delivery_failed',
            'delivery_id' => $deliveryId,
            'order_id' => $orderId,
            'courier_id' => $courierId,
            'reason' => $reason,
        ]);
    }

    public static function deliveryResolved(int $deliveryId, string $resolution, int $resolvedBy): void
    {
        Log::channel('operational')->info('Delivery resolved', [
            'event' => 'delivery_resolved',
            'delivery_id' => $deliveryId,
            'resolution' => $resolution,
            'resolved_by' => $resolvedBy,
        ]);
    }

    public static function inventoryException(int $outletId, ?int $productId, string $type, int $required, int $available): void
    {
        Log::channel('operational')->error('Inventory exception', [
            'event' => 'inventory_exception',
            'outlet_id' => $outletId,
            'product_id' => $productId,
            'stock_type' => $type,
            'required' => $required,
            'available' => $available,
            'actor_id' => Auth::id(),
        ]);
    }

    public static function orderCreated(int $orderId, string $orderCode, int $outletId, int $customerId): void
    {
        Log::channel('operational')->info('Order created', [
            'event' => 'order_created',
            'order_id' => $orderId,
            'order_code' => $orderCode,
            'outlet_id' => $outletId,
            'customer_id' => $customerId,
        ]);
    }

    public static function unauthorizedAccess(string $action, ?int $userId = null): void
    {
        Log::channel('operational')->warning('Unauthorized access attempt', [
            'event' => 'unauthorized_access',
            'action' => $action,
            'user_id' => $userId ?? Auth::id(),
            'ip' => request()->ip(),
        ]);
    }

    public static function operationalError(string $message, array $context = []): void
    {
        Log::channel('operational')->error($message, [
            'event' => 'operational_error',
            'actor_id' => Auth::id(),
            ...$context,
        ]);
    }
}
