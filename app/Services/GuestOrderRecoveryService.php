<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use Illuminate\Support\Collection;

class GuestOrderRecoveryService
{
    private const MAX_ORDERS = 10;
    private const MAX_DAYS = 30;

    public function recoverByPhone(string $phone): array
    {
        $normalizedPhone = $this->normalizePhone($phone);

        if (! preg_match('/^62[0-9]{9,13}$/', $normalizedPhone)) {
            return [
                'found' => false,
                'active_orders' => [],
                'recent_orders' => [],
            ];
        }

        $customer = Customer::query()
            ->where('phone', $normalizedPhone)
            ->first();

        if (! $customer) {
            return [
                'found' => false,
                'active_orders' => [],
                'recent_orders' => [],
            ];
        }

        $activeOrders = Order::query()
            ->where('customer_id', $customer->id)
            ->whereIn('status', Order::ACTIVE_STATUSES)
            ->with(['outlet:id,name', 'items'])
            ->latest()
            ->get()
            ->map(fn (Order $order) => $this->formatOrder($order));

        $recentOrders = Order::query()
            ->where('customer_id', $customer->id)
            ->whereIn('status', Order::HISTORY_STATUSES)
            ->where('ordered_at', '>=', now()->subDays(self::MAX_DAYS))
            ->with(['outlet:id,name', 'items'])
            ->latest()
            ->limit(self::MAX_ORDERS)
            ->get()
            ->map(fn (Order $order) => $this->formatOrder($order));

        return [
            'found' => true,
            'customer_name' => $customer->name,
            'active_orders' => $activeOrders->all(),
            'recent_orders' => $recentOrders->all(),
        ];
    }

    private function formatOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'order_code' => $order->order_code,
            'status' => $order->status,
            'fulfillment_type' => $order->fulfillment_type,
            'total' => (float) $order->total,
            'customer_name' => $order->customer_name,
            'outlet' => $order->outlet ? ['id' => $order->outlet->id, 'name' => $order->outlet->name] : null,
            'items' => $order->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'quantity' => $item->quantity,
            ])->values()->all(),
            'ordered_at' => $order->ordered_at?->toISOString(),
            'created_at' => $order->ordered_at?->toISOString(),
        ];
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (str_starts_with($digits, '0')) {
            return '62'.substr($digits, 1);
        }

        if (str_starts_with($digits, '8')) {
            return '62'.$digits;
        }

        return $digits;
    }
}
