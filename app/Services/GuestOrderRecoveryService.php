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
     * Recover orders using phone number.
     * Phone number is the sole proof of ownership — no second factor needed.
     *
     * @param  bool  $activeOnly  If true, return only active orders (for guest users)
     */
    public function recover(string $phone, ?string $recoveryToken = null, ?string $orderCode = null, bool $activeOnly = false): array
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

        // If customer is linked to a user account
        if ($customer->user_id) {
            // If not logged in or different user, require login
            if (! auth()->check() || auth()->id() !== $customer->user_id) {
                return [
                    'found' => true,
                    'requires_verification' => true,
                    'is_different_account' => auth()->check(),
                    'customer_name' => null, // Don't expose registered user's name
                    'active_orders' => [],
                    'recent_orders' => [],
                ];
            }
            // Logged-in user is the owner — fall through to return orders
        }

        $activeOrders = Order::query()
            ->where('customer_id', $customer->id)
            ->whereIn('status', Order::ACTIVE_STATUSES)
            ->where(function ($q) {
                $q->whereNull('payment_status')
                    ->orWhere('payment_status', 'pending')
                    ->orWhere('payment_status', 'paid')
                    ->orWhere(function ($q2) {
                        $q2->whereIn('payment_status', ['failed', 'expired'])
                            ->where('status', Order::STATUS_PENDING_CONFIRMATION);
                    });
            })
            ->where(function ($q) {
                $q->where('status', '!=', Order::STATUS_PENDING_CONFIRMATION)
                    ->orWhereNull('confirmation_expires_at')
                    ->orWhere('confirmation_expires_at', '>', now());
            })
            ->with(['outlet:id,name', 'items.variant.family'])
            ->latest()
            ->get()
            ->map(fn (Order $order) => $this->formatOrder($order));

        // Guest users also see recent history (includes expired/cancelled for "Pesan Ulang")
        $recentOrders = $activeOnly
            ? Order::query()
                ->where('customer_id', $customer->id)
                ->whereIn('status', array_merge(Order::HISTORY_STATUSES, [Order::STATUS_EXPIRED]))
                ->where('ordered_at', '>=', now()->subDays(self::MAX_DAYS))
                ->with(['outlet:id,name', 'items.variant.family'])
                ->latest()
                ->limit(self::MAX_ORDERS)
                ->get()
                ->map(fn (Order $order) => $this->formatOrder($order))
            : Order::query()
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
            'payment_status' => $order->payment_status,
            'fulfillment_type' => $order->fulfillment_type,
            'total' => (float) $order->total,
            'customer_name' => $order->customer_name,
            'outlet' => $order->outlet ? ['id' => $order->outlet->id, 'name' => $order->outlet->name] : null,
            'items' => $order->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'quantity' => $item->quantity,
                'image' => $item->variant?->family?->image,
            ])->values()->all(),
            'ordered_at' => $order->ordered_at?->toISOString(),
            'created_at' => $order->ordered_at?->toISOString(),
        ];
    }
}
