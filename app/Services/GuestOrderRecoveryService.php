<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Support\PhoneNormalizer;

class GuestOrderRecoveryService
{
    private const MAX_ORDERS = 10;

    private const MAX_DAYS = 30;

    /**
     * Recover orders using phone + recovery_token OR phone + order_code OR phone only.
     */
    public function recover(string $phone, ?string $recoveryToken = null, ?string $orderCode = null): array
    {
        $normalizedPhone = PhoneNormalizer::normalize($phone);

        if (! PhoneNormalizer::isValidIndonesian($normalizedPhone)) {
            return $this->notFoundResponse();
        }

        $customer = Customer::query()
            ->where('phone', $normalizedPhone)
            ->first();

        if (! $customer) {
            return $this->notFoundResponse();
        }

        // If recovery_token or order_code provided, verify it matches this customer
        if ($recoveryToken) {
            $order = Order::query()
                ->where('customer_id', $customer->id)
                ->where('recovery_token', strtoupper(trim($recoveryToken)))
                ->first();

            if (! $order) {
                return $this->notFoundResponse();
            }
        } elseif ($orderCode) {
            $order = Order::query()
                ->where('customer_id', $customer->id)
                ->where('order_code', strtoupper($orderCode))
                ->first();

            if (! $order) {
                return $this->notFoundResponse();
            }
        }

        // Phone-only lookup is allowed — return all orders for this customer

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
            'customer_id' => $customer->id,
            'customer_name' => $customer->name,
            'active_orders' => $activeOrders->all(),
            'recent_orders' => $recentOrders->all(),
        ];
    }

    private function notFoundResponse(): array
    {
        return [
            'found' => false,
            'active_orders' => [],
            'recent_orders' => [],
        ];
    }

    private function formatOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'order_code' => $order->order_code,
            'recovery_token' => $order->recovery_token,
            'tracking_url' => $order->tracking_url,
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
}
