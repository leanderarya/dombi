<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    protected $fillable = [
        'user_type',
        'user_id',
        'customer_id',
        'type',
        'title',
        'message',
        'data',
        'entity_type',
        'entity_id',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function markAsRead(): void
    {
        if ($this->read_at === null) {
            $this->update(['read_at' => now()]);
        }
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->whereNull('read_at');
    }

    public function scopeForUser(Builder $query, string $userType, int $userId): Builder
    {
        return $query->where('user_type', $userType)->where('user_id', $userId);
    }

    public function scopeForCustomer(Builder $query, int $customerId): Builder
    {
        return $query->where('customer_id', $customerId);
    }

    public function scopeRecent(Builder $query, int $days = 7): Builder
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    /**
     * Where an in-app notification should take its recipient.
     *
     * Resolved on the server because the destination depends on who received
     * it: `order.created` belongs to the outlet's screen, `payment.verified`
     * to the outlet's settlement page — never the owner's.
     *
     * @param  array<string, mixed>  $data
     */
    public static function destinationUrl(string $type, array $data = [], ?string $role = null): ?string
    {
        $orderId = $data['order_id'] ?? null;
        $deliveryId = $data['delivery_id'] ?? null;
        $restockId = $data['restock_id'] ?? null;
        $returnId = $data['return_request_id'] ?? null;
        $exchangeId = $data['exchange_request_id'] ?? null;
        $settlementId = $data['settlement_id'] ?? null;
        $reportId = $data['report_id'] ?? null;

        // The refund path already writes a role-correct url.
        if (is_string($data['url'] ?? null) && str_starts_with($data['url'], '/')) {
            return $data['url'];
        }

        return match (true) {
            str_starts_with($type, 'order.refund_') => $role === 'owner'
                ? '/owner/finance?tab=refund'
                : ($orderId ? "/customer/orders/{$orderId}" : '/customer/orders'),

            str_starts_with($type, 'order.') => match ($role) {
                'outlet' => $orderId ? "/outlet/orders/{$orderId}" : '/outlet/orders',
                'customer' => $orderId ? "/customer/orders/{$orderId}" : '/customer/orders',
                'owner' => '/owner/orders',
                default => null,
            },

            str_starts_with($type, 'delivery.') => match ($role) {
                'courier' => $deliveryId ? "/courier/deliveries/{$deliveryId}" : '/courier/deliveries',
                'outlet' => $deliveryId ? "/outlet/deliveries/{$deliveryId}" : '/outlet/deliveries',
                'owner' => '/owner/deliveries',
                'customer' => $orderId ? "/customer/orders/{$orderId}" : '/customer/orders',
                default => null,
            },

            str_starts_with($type, 'inventory.restock') => $restockId
                ? ($role === 'owner' ? "/owner/restocks/{$restockId}" : "/outlet/restocks/{$restockId}")
                : null,

            in_array($type, ['inventory.distribution_sent', 'inventory.distribution_received'], true) => $restockId
                ? ($role === 'owner' ? "/owner/restocks/{$restockId}" : "/outlet/restocks/{$restockId}")
                : null,

            str_starts_with($type, 'inventory.') => match ($role) {
                'owner' => '/owner/inventories',
                'outlet' => '/outlet/restocks',
                default => null,
            },

            str_starts_with($type, 'return.') || str_starts_with($type, 'inventory.return_request_') => $returnId
                ? ($role === 'owner' ? "/owner/returns/{$returnId}" : "/outlet/returns/{$returnId}")
                : null,

            str_starts_with($type, 'exchange.') || str_starts_with($type, 'inventory.exchange_request_') => $exchangeId
                ? ($role === 'owner' ? "/owner/exchanges/{$exchangeId}" : "/outlet/exchanges/{$exchangeId}")
                : null,

            str_starts_with($type, 'settlement.') => $role === 'outlet'
                ? ($settlementId ? "/outlet/settlement/{$settlementId}" : '/outlet/settlement-payments')
                : ($role === 'owner' ? '/owner/finance' : null),

            str_starts_with($type, 'payment.') || str_starts_with($type, 'payout.') => match ($role) {
                'owner' => '/owner/finance',
                'outlet' => '/outlet/settlement-payments',
                default => null,
            },

            str_starts_with($type, 'system.courier_') || $type === 'system.capacity_warning' => $role === 'owner'
                ? '/owner/couriers'
                : null,

            in_array($type, ['new_order_report', 'order_report_updated', 'order_report_resolved'], true) => match ($role) {
                'owner' => $reportId ? "/owner/order-reports/{$reportId}" : '/owner/orders',
                'outlet' => $reportId ? "/outlet/order-reports/{$reportId}" : '/outlet/orders',
                'customer' => $orderId ? "/customer/orders/{$orderId}" : '/customer/orders',
                default => null,
            },

            default => null,
        };
    }
}
