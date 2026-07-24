<?php

namespace App\Services;

use App\Enums\RefundRejectionReason;
use App\Jobs\PushNotificationJob;
use App\Models\Customer;
use App\Models\Delivery;
use App\Models\ExchangeRequest;
use App\Models\Notification;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\RefundStatusHistory;
use App\Models\RestockRequest;
use App\Models\ReturnRequest;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class NotificationService
{
    // Order notifications
    public const ORDER_CREATED = 'order.created';

    public const ORDER_CONFIRMED = 'order.confirmed';

    public const ORDER_REJECTED = 'order.rejected';

    public const ORDER_EXPIRED = 'order.expired';

    public const ORDER_CANCELLED = 'order.cancelled';

    public const ORDER_PREPARING = 'order.preparing';

    public const ORDER_READY_FOR_PICKUP = 'order.ready_for_pickup';

    public const ORDER_PICKED_UP = 'order.picked_up';

    public const ORDER_DELIVERING = 'order.delivering';

    public const ORDER_COMPLETED = 'order.completed';

    // Delivery notifications
    public const COURIER_ASSIGNED = 'delivery.courier_assigned';

    public const COURIER_REJECTED_ASSIGNMENT = 'delivery.courier_rejected_assignment';

    public const COURIER_PICKED_UP = 'delivery.picked_up';

    public const DELIVERY_OUT_FOR_DELIVERY = 'delivery.out_for_delivery';

    public const DELIVERY_COMPLETED = 'delivery.completed';

    public const DELIVERY_FAILED = 'delivery.failed';

    public const DELIVERY_RETURNED_TO_OUTLET = 'delivery.returned_to_outlet';

    // Inventory notifications
    public const LOW_STOCK = 'inventory.low_stock';

    public const CRITICAL_STOCK = 'inventory.critical_stock';

    public const RESTOCK_CREATED = 'inventory.restock_created';

    public const RESTOCK_APPROVED = 'inventory.restock_approved';

    public const RESTOCK_REJECTED = 'inventory.restock_rejected';

    public const DISTRIBUTION_SENT = 'inventory.distribution_sent';

    public const DISTRIBUTION_RECEIVED = 'inventory.distribution_received';

    public const RETURN_REQUEST_CREATED = 'inventory.return_request_created';

    public const RETURN_APPROVED = 'return.approved';

    public const RETURN_REJECTED = 'return.rejected';

    public const RETURN_RECEIVED = 'return.received';

    public const RETURN_COMPLETED = 'return.completed';

    public const EXCHANGE_REQUEST_CREATED = 'inventory.exchange_request_created';

    public const EXCHANGE_APPROVED = 'exchange.approved';

    public const EXCHANGE_REJECTED = 'exchange.rejected';

    public const EXCHANGE_SHIPPED = 'exchange.shipped';

    public const EXCHANGE_RECEIVED = 'exchange.received';

    public const EXCHANGE_COMPLETED = 'exchange.completed';

    // System notifications
    public const SLA_VIOLATION = 'system.sla_violation';

    public const COURIER_OFFLINE = 'system.courier_offline';

    public const CAPACITY_WARNING = 'system.capacity_warning';

    public const RETURNED_DELIVERY_PENDING = 'system.returned_delivery_pending';

    // Refund notifications
    public const REFUND_REQUESTED = 'order.refund_requested';

    public const REFUND_DESTINATION_SUBMITTED = 'order.refund_destination_submitted';

    public const REFUND_PROCESSING_STARTED = 'order.refund_processing_started';

    public const REFUND_PROCESSED = 'order.refund_processed';

    public const REFUND_REJECTED = 'order.refund_rejected';

    public const REFUND_ROLLED_BACK = 'order.refund_rolled_back';

    public const REFUND_FAILED = 'order.refund_failed';

    // Settlement notifications
    public const SETTLEMENT_REMINDER = 'settlement.reminder';

    public const SETTLEMENT_GENERATED = 'settlement.generated';

    public const PAYMENT_SUBMITTED = 'payment.submitted';

    public const PAYMENT_VERIFIED = 'payment.verified';

    public const PAYMENT_REJECTED = 'payment.rejected';

    /**
     * Get the owner user(s) for notification targeting.
     */
    private function getOwners(): array
    {
        return User::where('role', 'owner')->where('is_active', true)->pluck('id')->toArray();
    }

    /**
     * Get the outlet user for a given outlet.
     */
    private function getOutletUser(int $outletId): ?User
    {
        return User::where('role', 'outlet')
            ->where('outlet_id', $outletId)
            ->where('is_active', true)
            ->first();
    }

    // ─── ORDER NOTIFICATIONS ──────────────────────────────────────────

    public function notifyOrderCreated(Order $order): void
    {
        // Notify outlet
        $outletUser = $this->getOutletUser($order->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::ORDER_CREATED,
                title: 'Pesanan Baru',
                message: "Pesanan baru {$order->order_code} dari {$order->customer_name}.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyOrderConfirmed(Order $order): void
    {
        // Notify customer
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::ORDER_CONFIRMED,
                title: 'Pesanan Dikonfirmasi',
                message: "Pesanan {$order->order_code} telah dikonfirmasi outlet.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyOrderRejected(Order $order, string $reason): void
    {
        // Notify customer
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::ORDER_REJECTED,
                title: 'Pesanan Ditolak',
                message: "Pesanan {$order->order_code} ditolak. Alasan: {$reason}",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code, 'reason' => $reason]
            );
        }

        // Notify owner
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::ORDER_REJECTED,
                title: 'Pesanan Ditolak Outlet',
                message: "Pesanan {$order->order_code} ditolak outlet. Alasan: {$reason}",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code, 'reason' => $reason]
            );
        }
    }

    public function notifyOrderExpired(Order $order): void
    {
        // Notify customer
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::ORDER_EXPIRED,
                title: 'Pesanan Kadaluarsa',
                message: "Pesanan {$order->order_code} kadaluarsa karena tidak dikonfirmasi.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code]
            );
        }
    }

    public function notifyOrderPreparing(Order $order): void
    {
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::ORDER_PREPARING,
                title: 'Pesanan Disiapkan',
                message: "Pesanan {$order->order_code} sedang disiapkan outlet.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyOrderReadyForPickup(Order $order): void
    {
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::ORDER_READY_FOR_PICKUP,
                title: 'Pesanan Siap Diambil',
                message: "Pesanan {$order->order_code} sudah siap diambil.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyOrderPickedUp(Order $order): void
    {
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::ORDER_PICKED_UP,
                title: 'Pesanan Diambil Kurir',
                message: "Pesanan {$order->order_code} telah diambil kurir.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyOrderDelivering(Order $order): void
    {
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::ORDER_DELIVERING,
                title: 'Pesanan Dalam Perjalanan',
                message: "Pesanan {$order->order_code} sedang dalam perjalanan.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyOrderCompleted(Order $order): void
    {
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::ORDER_COMPLETED,
                title: 'Pesanan Selesai',
                message: "Pesanan {$order->order_code} telah selesai.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyOrderCancelled(Order $order): void
    {
        // Notify outlet
        $outletUser = $this->getOutletUser($order->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::ORDER_CANCELLED,
                title: 'Pesanan Dibatalkan',
                message: "Pesanan {$order->order_code} dibatalkan customer.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code]
            );
        }
    }

    // ─── DELIVERY NOTIFICATIONS ───────────────────────────────────────

    public function notifyCourierAssigned(Delivery $delivery): void
    {
        $order = $delivery->order;

        // Notify customer
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::COURIER_ASSIGNED,
                title: 'Kurir Di-assign',
                message: "Kurir telah ditugaskan untuk pesanan {$order->order_code}.",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id, 'courier_id' => $delivery->courier_id]
            );
        }

        // Notify courier
        $this->create(
            userType: 'courier',
            userId: $delivery->courier_id,
            customerId: null,
            type: self::COURIER_ASSIGNED,
            title: 'Tugas Baru',
            message: "Anda mendapat tugas pengiriman untuk pesanan {$order->order_code}.",
            data: ['order_id' => $order->id, 'delivery_id' => $delivery->id]
        );

        // Notify outlet
        $outletUser = $this->getOutletUser($order->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::COURIER_ASSIGNED,
                title: 'Kurir Di-assign',
                message: "Kurir telah di-assign untuk pesanan {$order->order_code}.",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id]
            );
        }
    }

    public function notifyCourierPickedUp(Delivery $delivery): void
    {
        $order = $delivery->order;

        // Notify customer
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::COURIER_PICKED_UP,
                title: 'Pesanan Diambil',
                message: "Pesanan {$order->order_code} telah diambil kurir.",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id]
            );
        }
    }

    public function notifyDeliveryOutForDelivery(Delivery $delivery): void
    {
        $order = $delivery->order;

        // Notify customer
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::DELIVERY_OUT_FOR_DELIVERY,
                title: 'Pesanan Dalam Perjalanan',
                message: "Pesanan {$order->order_code} sedang dalam perjalanan ke alamat Anda.",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id]
            );
        }
    }

    public function notifyDeliveryCompleted(Delivery $delivery): void
    {
        $order = $delivery->order;

        // Notify customer
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::DELIVERY_COMPLETED,
                title: 'Pesanan Selesai',
                message: "Pesanan {$order->order_code} telah berhasil dikirim.",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id]
            );
        }

        // Notify outlet
        $outletUser = $this->getOutletUser($order->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::DELIVERY_COMPLETED,
                title: 'Pengiriman Selesai',
                message: "Pesanan {$order->order_code} berhasil dikirim.",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id]
            );
        }
    }

    public function notifyDeliveryFailed(Delivery $delivery, string $reason): void
    {
        $order = $delivery->order;

        // Notify customer
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::DELIVERY_FAILED,
                title: 'Pengiriman Gagal',
                message: "Pengiriman pesanan {$order->order_code} gagal. Alasan: {$reason}",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id, 'reason' => $reason]
            );
        }

        // Notify owner
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::DELIVERY_FAILED,
                title: 'Pengiriman Gagal',
                message: "Pengiriman {$order->order_code} gagal. Alasan: {$reason}",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id, 'reason' => $reason]
            );
        }

        // Notify outlet
        $outletUser = $this->getOutletUser($order->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::DELIVERY_FAILED,
                title: 'Pengiriman Gagal',
                message: "Pengiriman {$order->order_code} gagal. Alasan: {$reason}",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id, 'reason' => $reason]
            );
        }
    }

    public function notifyReturnedToOutlet(Delivery $delivery): void
    {
        $order = $delivery->order;

        // Notify outlet
        $outletUser = $this->getOutletUser($order->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::DELIVERY_RETURNED_TO_OUTLET,
                title: 'Barang Dikembalikan',
                message: "Barang pesanan {$order->order_code} sedang dikembalikan ke outlet.",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id]
            );
        }

        // Notify owner
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::DELIVERY_RETURNED_TO_OUTLET,
                title: 'Barang Dikembalikan ke Outlet',
                message: "Barang pesanan {$order->order_code} dikembalikan ke outlet.",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id]
            );
        }
    }

    // ─── OPERATIONAL NOTIFICATIONS ────────────────────────────────────

    public function notifyCourierRejectedAssignment(Delivery $delivery, string $reason): void
    {
        $order = $delivery->order;

        // Notify owner
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::COURIER_REJECTED_ASSIGNMENT,
                title: 'Kurir Menolak Tugas',
                message: "Kurir menolak tugas untuk pesanan {$order->order_code}. Alasan: {$reason}",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id, 'courier_id' => $delivery->courier_id, 'reason' => $reason]
            );
        }

        // Notify outlet
        $outletUser = $this->getOutletUser($order->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::COURIER_REJECTED_ASSIGNMENT,
                title: 'Kurir Menolak Tugas',
                message: "Kurir menolak tugas untuk pesanan {$order->order_code}.",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id]
            );
        }
    }

    public function notifySlaViolation(string $title, string $message, array $data = []): void
    {
        // Notify all owners
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::SLA_VIOLATION,
                title: $title,
                message: $message,
                data: $data
            );
        }
    }

    public function notifyReturnedDeliveryPending(Delivery $delivery): void
    {
        $order = $delivery->order;

        // Notify outlet to confirm receipt
        $outletUser = $this->getOutletUser($order->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::RETURNED_DELIVERY_PENDING,
                title: 'Konfirmasi Penerimaan Barang',
                message: "Barang pesanan {$order->order_code} menunggu konfirmasi penerimaan.",
                data: ['order_id' => $order->id, 'delivery_id' => $delivery->id]
            );
        }
    }

    // ─── INVENTORY NOTIFICATIONS ─────────────────────────────────────

    public function notifyLowStock(int $outletId, string $productName, int $available, int $minimum): void
    {
        // Notify outlet
        $outletUser = $this->getOutletUser($outletId);
        if ($outletUser) {
            $isCritical = $available <= 0;
            $severity = $isCritical ? self::CRITICAL_STOCK : self::LOW_STOCK;
            $title = $isCritical ? 'Stok Kritis' : 'Stok Rendah';
            $message = "{$productName}: tersedia {$available}, minimum {$minimum}.";

            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: $severity,
                title: $title,
                message: $message,
                data: ['outlet_id' => $outletId, 'product_name' => $productName, 'available' => $available, 'minimum' => $minimum],
                entityType: 'outlet',
                entityId: $outletId
            );

        }

        // Notify owners
        $severity = $available <= 0 ? self::CRITICAL_STOCK : self::LOW_STOCK;
        $title = $available <= 0 ? 'Stok Kritis' : 'Stok Rendah';
        $outletName = Outlet::find($outletId)?->name ?? 'Unknown';
        $message = "{$productName} di {$outletName}: tersedia {$available}, minimum {$minimum}.";

        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: $severity,
                title: $title,
                message: $message,
                data: ['outlet_id' => $outletId, 'product_name' => $productName, 'available' => $available, 'minimum' => $minimum],
                entityType: 'outlet',
                entityId: $outletId
            );
        }
    }

    public function notifyRestockCreated(RestockRequest $restock): void
    {
        // Notify owners
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::RESTOCK_CREATED,
                title: 'Request Restock Baru',
                message: "Request restock baru dari outlet {$restock->outlet->name}.",
                data: ['restock_id' => $restock->id, 'outlet_id' => $restock->outlet_id],
                entityType: 'restock_request',
                entityId: $restock->id
            );
        }
    }

    public function notifyRestockApproved(RestockRequest $restock): void
    {
        // Notify outlet
        $outletUser = $this->getOutletUser($restock->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::RESTOCK_APPROVED,
                title: 'Restock Disetujui',
                message: "Request restock #{$restock->id} telah disetujui.",
                data: ['restock_id' => $restock->id],
                entityType: 'restock_request',
                entityId: $restock->id
            );
        }
    }

    public function notifyRestockRejected(RestockRequest $restock, string $reason): void
    {
        // Notify outlet
        $outletUser = $this->getOutletUser($restock->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::RESTOCK_REJECTED,
                title: 'Restock Ditolak',
                message: "Request restock #{$restock->id} ditolak. Alasan: {$reason}",
                data: ['restock_id' => $restock->id, 'reason' => $reason],
                entityType: 'restock_request',
                entityId: $restock->id
            );
        }
    }

    public function notifyRestockShipped(RestockRequest $restock): void
    {
        // Notify outlet
        $outletUser = $this->getOutletUser($restock->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::DISTRIBUTION_SENT,
                title: 'Restock Dikirim',
                message: "Restock #{$restock->id} sedang dikirim ke outlet Anda.",
                data: ['restock_id' => $restock->id],
                entityType: 'restock_request',
                entityId: $restock->id
            );
        }
    }

    public function notifyRestockReceived(RestockRequest $restock): void
    {
        // Notify owners
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::DISTRIBUTION_RECEIVED,
                title: 'Restock Diterima',
                message: "Restock #{$restock->id} telah diterima outlet.",
                data: ['restock_id' => $restock->id],
                entityType: 'restock_request',
                entityId: $restock->id
            );
        }
    }

    public function notifyReturnRequestCreated(ReturnRequest $return): void
    {
        $return->loadMissing(['outlet', 'items.variant.family']);

        $firstItem = $return->items->first();
        $itemSummary = $firstItem
            ? (($firstItem->variant?->full_name ?: $firstItem->variant?->name ?: 'Produk')." x{$firstItem->quantity}")
            : 'Tanpa item';

        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::RETURN_REQUEST_CREATED,
                title: 'Return Request Baru',
                message: "{$return->outlet->name} mengajukan return: {$itemSummary}.",
                data: [
                    'return_request_id' => $return->id,
                    'outlet_id' => $return->outlet_id,
                    'reason' => $return->reason,
                    'item_summary' => $itemSummary,
                ],
                entityType: 'return_request',
                entityId: $return->id
            );
        }
    }

    public function notifyExchangeRequestCreated(ExchangeRequest $exchange): void
    {
        $exchange->loadMissing(['outlet', 'items.variant.family', 'returnRequest']);

        $firstItem = $exchange->items->first();
        $itemSummary = $firstItem
            ? (($firstItem->variant?->full_name ?: $firstItem->variant?->name ?: 'Produk')." x{$firstItem->quantity}")
            : 'Tanpa item';

        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::EXCHANGE_REQUEST_CREATED,
                title: 'Exchange Request Baru',
                message: "{$exchange->outlet->name} mengajukan tukar produk: {$itemSummary}.",
                data: [
                    'exchange_request_id' => $exchange->id,
                    'return_request_id' => $exchange->return_request_id,
                    'outlet_id' => $exchange->outlet_id,
                    'item_summary' => $itemSummary,
                ],
                entityType: 'exchange_request',
                entityId: $exchange->id
            );
        }
    }

    // ─── RETURN STATUS NOTIFICATIONS ─────────────────────────────────

    public function notifyReturnApproved(ReturnRequest $return): void
    {
        $return->loadMissing(['outlet', 'items.variant.family']);

        $outletUser = $this->getOutletUser($return->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::RETURN_APPROVED,
                title: 'Return Disetujui',
                message: "Return #{$return->id} dari outlet {$return->outlet->name} telah disetujui.",
                data: [
                    'return_request_id' => $return->id,
                    'outlet_id' => $return->outlet_id,
                ],
                entityType: 'return_request',
                entityId: $return->id
            );
        }
    }

    public function notifyReturnRejected(ReturnRequest $return, string $reason): void
    {
        $return->loadMissing(['outlet']);

        $outletUser = $this->getOutletUser($return->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::RETURN_REJECTED,
                title: 'Return Ditolak',
                message: "Return #{$return->id} ditolak. Alasan: {$reason}",
                data: [
                    'return_request_id' => $return->id,
                    'outlet_id' => $return->outlet_id,
                    'reason' => $reason,
                ],
                entityType: 'return_request',
                entityId: $return->id
            );
        }
    }

    public function notifyReturnReceived(ReturnRequest $return): void
    {
        $return->loadMissing(['outlet']);

        $outletUser = $this->getOutletUser($return->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::RETURN_RECEIVED,
                title: 'Return Diterima di Pusat',
                message: "Return #{$return->id} telah diterima di pusat.",
                data: [
                    'return_request_id' => $return->id,
                    'outlet_id' => $return->outlet_id,
                ],
                entityType: 'return_request',
                entityId: $return->id
            );
        }
    }

    public function notifyReturnCompleted(ReturnRequest $return): void
    {
        $return->loadMissing(['outlet']);

        $outletUser = $this->getOutletUser($return->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::RETURN_COMPLETED,
                title: 'Return Selesai',
                message: "Return #{$return->id} telah selesai diproses.",
                data: [
                    'return_request_id' => $return->id,
                    'outlet_id' => $return->outlet_id,
                    'total_value' => $return->total_value,
                ],
                entityType: 'return_request',
                entityId: $return->id
            );
        }
    }

    // ─── EXCHANGE STATUS NOTIFICATIONS ───────────────────────────────

    public function notifyExchangeApproved(ExchangeRequest $exchange): void
    {
        $exchange->loadMissing(['outlet']);

        $outletUser = $this->getOutletUser($exchange->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::EXCHANGE_APPROVED,
                title: 'Exchange Disetujui',
                message: "Exchange #{$exchange->id} telah disetujui.",
                data: [
                    'exchange_request_id' => $exchange->id,
                    'outlet_id' => $exchange->outlet_id,
                ],
                entityType: 'exchange_request',
                entityId: $exchange->id
            );
        }
    }

    public function notifyExchangeRejected(ExchangeRequest $exchange, string $reason): void
    {
        $exchange->loadMissing(['outlet']);

        $outletUser = $this->getOutletUser($exchange->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::EXCHANGE_REJECTED,
                title: 'Exchange Ditolak',
                message: "Exchange #{$exchange->id} ditolak. Alasan: {$reason}",
                data: [
                    'exchange_request_id' => $exchange->id,
                    'outlet_id' => $exchange->outlet_id,
                    'reason' => $reason,
                ],
                entityType: 'exchange_request',
                entityId: $exchange->id
            );
        }
    }

    public function notifyExchangeShipped(ExchangeRequest $exchange): void
    {
        $exchange->loadMissing(['outlet']);

        $outletUser = $this->getOutletUser($exchange->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::EXCHANGE_SHIPPED,
                title: 'Exchange Dikirim',
                message: "Barang pengganti untuk Exchange #{$exchange->id} sedang dikirim ke outlet.",
                data: [
                    'exchange_request_id' => $exchange->id,
                    'outlet_id' => $exchange->outlet_id,
                ],
                entityType: 'exchange_request',
                entityId: $exchange->id
            );
        }
    }

    public function notifyExchangeReceived(ExchangeRequest $exchange): void
    {
        $exchange->loadMissing(['outlet']);

        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::EXCHANGE_RECEIVED,
                title: 'Exchange Diterima Outlet',
                message: "Exchange #{$exchange->id} telah diterima oleh outlet {$exchange->outlet->name}.",
                data: [
                    'exchange_request_id' => $exchange->id,
                    'outlet_id' => $exchange->outlet_id,
                ],
                entityType: 'exchange_request',
                entityId: $exchange->id
            );
        }
    }

    public function notifyExchangeCompleted(ExchangeRequest $exchange): void
    {
        $exchange->loadMissing(['outlet']);

        $outletUser = $this->getOutletUser($exchange->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::EXCHANGE_COMPLETED,
                title: 'Exchange Selesai',
                message: "Exchange #{$exchange->id} telah selesai diproses.",
                data: [
                    'exchange_request_id' => $exchange->id,
                    'outlet_id' => $exchange->outlet_id,
                    'exchange_value' => $exchange->exchange_value,
                ],
                entityType: 'exchange_request',
                entityId: $exchange->id
            );
        }
    }

    // ─── SYSTEM NOTIFICATIONS ────────────────────────────────────────

    public function notifyCourierOffline(User $courier): void
    {
        // Notify owners
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::COURIER_OFFLINE,
                title: 'Kurir Offline',
                message: "Kurir {$courier->name} telah offline.",
                data: ['courier_id' => $courier->id],
                entityType: 'user',
                entityId: $courier->id
            );
        }
    }

    public function notifyCapacityWarning(User $courier, int $activeCount, int $maxCount): void
    {
        // Notify owners
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::CAPACITY_WARNING,
                title: 'Kapasitas Kurir Penuh',
                message: "Kurir {$courier->name} memiliki {$activeCount} delivery aktif (maks {$maxCount}).",
                data: ['courier_id' => $courier->id, 'active_count' => $activeCount, 'max_count' => $maxCount],
                entityType: 'user',
                entityId: $courier->id
            );
        }
    }

    // ─── SETTLEMENT NOTIFICATIONS ────────────────────────────────────

    public function notifySettlementReminder(Settlement $settlement): void
    {
        $outletUser = $this->getOutletUser($settlement->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::SETTLEMENT_REMINDER,
                title: 'Pengingat Pembayaran',
                message: "Settlement untuk periode {$settlement->period_date->format('d/m/Y')} jatuh tempo besok. Jumlah: Rp ".number_format($settlement->amount_due, 0, ',', '.'),
                data: ['settlement_id' => $settlement->id, 'amount_due' => $settlement->amount_due, 'due_date' => $settlement->due_date->toDateString()],
                entityType: 'settlement',
                entityId: $settlement->id
            );
        }
    }

    public function notifySettlementGenerated(Settlement $settlement): void
    {
        $outletUser = $this->getOutletUser($settlement->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::SETTLEMENT_GENERATED,
                title: 'Settlement Baru',
                message: "Settlement untuk periode {$settlement->period_date->format('d/m/Y')} telah dibuat. Jumlah: Rp ".number_format($settlement->amount_due, 0, ',', '.'),
                data: ['settlement_id' => $settlement->id, 'amount_due' => $settlement->amount_due],
                entityType: 'settlement',
                entityId: $settlement->id
            );
        }
    }

    public function notifyPaymentSubmitted(SettlementPayment $payment): void
    {
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::PAYMENT_SUBMITTED,
                title: 'Pembayaran Baru',
                message: "Outlet {$payment->outlet->name} mengirim pembayaran Rp ".number_format($payment->amount, 0, ',', '.')." (Ref: {$payment->reference_number})",
                data: ['payment_id' => $payment->id, 'outlet_id' => $payment->outlet_id, 'amount' => $payment->amount, 'reference_number' => $payment->reference_number],
                entityType: 'settlement_payment',
                entityId: $payment->id
            );
        }
    }

    public function notifyPaymentVerified(SettlementPayment $payment): void
    {
        $outletUser = $this->getOutletUser($payment->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::PAYMENT_VERIFIED,
                title: 'Pembayaran Diverifikasi',
                message: "Pembayaran {$payment->reference_number} sebesar Rp ".number_format($payment->amount, 0, ',', '.').' telah diverifikasi.',
                data: ['payment_id' => $payment->id, 'amount' => $payment->amount, 'reference_number' => $payment->reference_number],
                entityType: 'settlement_payment',
                entityId: $payment->id
            );
        }
    }

    public function notifyPaymentRejected(SettlementPayment $payment, string $reason): void
    {
        $outletUser = $this->getOutletUser($payment->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::PAYMENT_REJECTED,
                title: 'Pembayaran Ditolak',
                message: "Pembayaran {$payment->reference_number} ditolak. Alasan: {$reason}",
                data: ['payment_id' => $payment->id, 'amount' => $payment->amount, 'reference_number' => $payment->reference_number, 'reason' => $reason],
                entityType: 'settlement_payment',
                entityId: $payment->id
            );
        }
    }

    // ─── REFUND NOTIFICATIONS ────────────────────────────────────────

    public function notifyRefundRequested(Order $order): void
    {
        $formattedAmount = 'Rp '.number_format($order->total, 0, ',', '.');

        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::REFUND_REQUESTED,
                title: 'Refund Diproses',
                message: "Pesanan {$order->order_code} dibatalkan. Refund sebesar {$formattedAmount} sedang diproses.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code, 'total' => $order->total, 'payment_status' => $order->payment_status],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyRefundDestinationSubmitted(Order $order, bool $updated): void
    {
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::REFUND_DESTINATION_SUBMITTED,
                title: $updated ? 'Tujuan Refund Diperbarui' : 'Tujuan Refund Disimpan',
                message: "Tujuan refund untuk pesanan {$order->order_code} telah ".($updated ? 'diperbarui' : 'disimpan').'.',
                data: ['order_id' => $order->id, 'order_code' => $order->order_code],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyRefundProcessingStarted(Order $order): void
    {
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::REFUND_PROCESSING_STARTED,
                title: 'Refund Sedang Ditransfer',
                message: "Owner sedang mentransfer refund pesanan {$order->order_code} ke tujuan refund Anda.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyRefundProcessed(Order $order, float $amount): void
    {
        $formattedAmount = 'Rp '.number_format($amount, 0, ',', '.');

        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::REFUND_PROCESSED,
                title: 'Refund Berhasil',
                message: "Owner telah mentransfer {$formattedAmount} ke tujuan refund Anda. Order #{$order->order_code} dibatalkan.",
                data: ['order_id' => $order->id, 'order_code' => $order->order_code, 'amount' => $amount],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyRefundRejected(Order $order, RefundRejectionReason $reason): void
    {
        if ($order->customer_id) {
            $this->create(
                userType: 'customer',
                userId: null,
                customerId: $order->customer_id,
                type: self::REFUND_REJECTED,
                title: 'Refund Ditolak',
                message: "Refund pesanan {$order->order_code} ditolak. Alasan: {$reason->label()}.".($reason->canResubmit() ? ' Silakan perbaiki dan kirim ulang tujuan refund.' : ''),
                data: ['order_id' => $order->id, 'order_code' => $order->order_code, 'reason' => $reason->value, 'can_resubmit' => $reason->canResubmit()],
                entityType: 'order',
                entityId: $order->id
            );
        }
    }

    public function notifyRefundEvent(Order $order, RefundStatusHistory $history): void
    {
        $order->loadMissing('customer');
        $isRegistered = $order->customer?->user_id !== null;

        $eventMap = $this->refundEventMap($history->event);

        if ($eventMap === null) {
            return;
        }

        [$type, $title, $message] = $eventMap;
        $queueFilter = $this->eventQueue($history->event, $order);
        $ownerUrl = $queueFilter ? "/owner/finance?tab=refund&filter={$queueFilter}" : null;
        $customerUrl = "/customer/orders/{$order->id}";

        $data = [
            'refund_history_id' => $history->id,
            'order_id' => $order->id,
            'order_code' => $order->order_code,
        ];

        // Customer notification
        if ($isRegistered && $this->shouldNotifyCustomer($history->event)) {
            $data['url'] = $customerUrl;
            $this->createRefundOnce($history, 'customer', null, $order->customer_id, $type, $title, $message, $data, $customerUrl);
        }

        // Owner notification
        if ($this->shouldNotifyOwner($history->event)) {
            foreach ($this->getOwners() as $ownerId) {
                $ownerData = $data;
                $ownerData['url'] = $ownerUrl ?? $customerUrl;
                $this->createRefundOnce($history, 'owner', $ownerId, null, $type, $title, $message, $ownerData, $ownerUrl ?? $customerUrl);
            }
        }
    }

    private function shouldNotifyCustomer(string $event): bool
    {
        return ! in_array($event, [
            RefundStatusHistory::EVENT_GUEST_DESTINATION_SUBMITTED_BY_OWNER,
            RefundStatusHistory::EVENT_GUEST_DESTINATION_UPDATED_BY_OWNER,
        ], true);
    }

    private function shouldNotifyOwner(string $event): bool
    {
        return in_array($event, [
            RefundStatusHistory::EVENT_REFUND_REQUESTED,
            RefundStatusHistory::EVENT_DESTINATION_SUBMITTED,
            RefundStatusHistory::EVENT_DESTINATION_UPDATED,
            RefundStatusHistory::EVENT_REFUND_REOPENED,
            RefundStatusHistory::EVENT_REFUND_FAILED,
        ], true);
    }

    private function refundEventMap(string $event): ?array
    {
        return match ($event) {
            RefundStatusHistory::EVENT_REFUND_REQUESTED => [
                self::REFUND_REQUESTED,
                'Refund Diproses',
                'Refund pesanan sedang diproses.',
            ],
            RefundStatusHistory::EVENT_DESTINATION_SUBMITTED,
            RefundStatusHistory::EVENT_DESTINATION_UPDATED,
            RefundStatusHistory::EVENT_REFUND_REOPENED => [
                self::REFUND_DESTINATION_SUBMITTED,
                'Tujuan Refund Disimpan',
                'Tujuan refund telah disimpan.',
            ],
            RefundStatusHistory::EVENT_GUEST_DESTINATION_SUBMITTED_BY_OWNER,
            RefundStatusHistory::EVENT_GUEST_DESTINATION_UPDATED_BY_OWNER => null,
            RefundStatusHistory::EVENT_PROCESSING_STARTED => [
                self::REFUND_PROCESSING_STARTED,
                'Refund Sedang Diproses',
                'Owner sedang memproses refund Anda.',
            ],
            RefundStatusHistory::EVENT_PROCESSING_ROLLED_BACK => [
                self::REFUND_ROLLED_BACK,
                'Refund Dikembalikan',
                'Proses refund dikembalikan ke antrean.',
            ],
            RefundStatusHistory::EVENT_REFUND_REJECTED => [
                self::REFUND_REJECTED,
                'Refund Ditolak',
                'Refund pesanan ditolak.',
            ],
            RefundStatusHistory::EVENT_REFUND_COMPLETED => [
                self::REFUND_PROCESSED,
                'Refund Berhasil',
                'Refund telah berhasil diproses.',
            ],
            RefundStatusHistory::EVENT_REFUND_FAILED => [
                self::REFUND_FAILED,
                'Refund Gagal',
                'Refund gagal diproses. Perlu tindakan.',
            ],
            default => null,
        };
    }

    private function eventQueue(string $event, Order $order): ?string
    {
        return match ($event) {
            RefundStatusHistory::EVENT_REFUND_REQUESTED => $order->isGuestCustomer() ? 'awaiting_guest' : 'awaiting_customer',
            RefundStatusHistory::EVENT_DESTINATION_SUBMITTED,
            RefundStatusHistory::EVENT_DESTINATION_UPDATED,
            RefundStatusHistory::EVENT_REFUND_REOPENED => 'ready',
            RefundStatusHistory::EVENT_REFUND_FAILED => 'action_required',
            default => null,
        };
    }

    private function createRefundOnce(RefundStatusHistory $history, string $userType, ?int $userId, ?int $customerId, string $type, string $title, string $message, array $data, string $url): void
    {
        DB::transaction(function () use ($history, $userType, $userId, $customerId, $type, $title, $message, $data, $url) {
            $history->fresh();
            RefundStatusHistory::lockForUpdate()->find($history->id);

            $exists = false;
            if ($userId) {
                $exists = Notification::where('type', $type)
                    ->where('entity_type', 'order')
                    ->where('entity_id', $history->order_id)
                    ->where('user_type', $userType)
                    ->where('user_id', $userId)
                    ->where('data->refund_history_id', $history->id)
                    ->exists();
            } elseif ($customerId) {
                $exists = Notification::where('type', $type)
                    ->where('entity_type', 'order')
                    ->where('entity_id', $history->order_id)
                    ->where('user_type', $userType)
                    ->where('customer_id', $customerId)
                    ->where('data->refund_history_id', $history->id)
                    ->exists();
            }

            if (! $exists) {
                $this->create(
                    userType: $userType,
                    userId: $userId,
                    customerId: $customerId,
                    type: $type,
                    title: $title,
                    message: $message,
                    data: $data,
                    entityType: 'order',
                    entityId: $history->order_id,
                );
            }
        });
    }

    // ─── HELPER METHODS ───────────────────────────────────────────────

    private function create(
        string $userType,
        ?int $userId,
        ?int $customerId,
        string $type,
        string $title,
        string $message,
        array $data = [],
        ?string $entityType = null,
        ?int $entityId = null
    ): ?Notification {
        try {
            $notification = Notification::create([
                'user_type' => $userType,
                'user_id' => $userId,
                'customer_id' => $customerId,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'data' => $data ?: null,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
            ]);

            // Dispatch push notification
            $pushUrl = $data['url'] ?? $this->getPushUrl($entityType, $entityId);

            if ($userId) {
                $user = User::find($userId);
                if ($user) {
                    dispatch(new PushNotificationJob(
                        user: $user,
                        customer: null,
                        title: $title,
                        body: $message,
                        data: [
                            'entity_type' => $entityType,
                            'entity_id' => $entityId,
                            'url' => $pushUrl,
                        ],
                    ));
                }
            } elseif ($customerId) {
                dispatch(new PushNotificationJob(
                    user: null,
                    customer: Customer::find($customerId),
                    title: $title,
                    body: $message,
                    data: [
                        'entity_type' => $entityType,
                        'entity_id' => $entityId,
                        'url' => $pushUrl,
                    ],
                ));
            }

            return $notification;
        } catch (\Throwable $e) {
            \Log::error("Failed to create notification: {$e->getMessage()}", [
                'type' => $type,
                'user_type' => $userType,
                'user_id' => $userId,
                'customer_id' => $customerId,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
            ]);

            return null;
        }
    }

    private function getPushUrl(?string $entityType, ?int $entityId): string
    {
        return match ($entityType) {
            'order' => $entityId ? "/customer/orders/{$entityId}" : '/customer/orders',
            'outlet' => '/outlet/orders',
            'restock_request' => '/outlet/restocks',
            'return_request' => '/outlet/returns',
            'exchange_request' => '/outlet/exchanges',
            'delivery' => '/courier/deliveries',
            'settlement_payment' => '/owner/finance',
            default => '/',
        };
    }
}
