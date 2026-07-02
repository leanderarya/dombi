import { getOrderStatus, getDeliveryStatus, getOrderStatusTone } from '@/lib/status-labels';

export const activeOrderStatuses = ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'] as const;
export const historyOrderStatuses = ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'] as const;

/** @deprecated Use getOrderStatus(status).label instead */
export function orderStatusLabel(status?: string | null): string {
    if (!status) {
        return '-';
    }
    return getOrderStatus(status).label;
}

export { getOrderStatusTone as orderStatusTone };

export function deliveryStatusLabel(status?: string | null): string {
    if (!status) {
        return '-';
    }
    return getDeliveryStatus(status).label;
}

export function getOrderStatusLabel(status: string, fulfillmentType?: string): string {
    const isPickup = fulfillmentType === 'pickup';

    if (status === 'ready_for_pickup') {
        return isPickup ? 'Siap Diambil' : 'Menunggu Kurir';
    }

    if (status === 'picked_up') {
        return 'Kurir Mengambil';
    }

    if (status === 'delivering') {
        return 'Sedang Diantar';
    }

    return orderStatusLabel(status);
}

export function orderProgressIndex(status: string, fulfillmentType?: string): number {
    const isPickup = fulfillmentType === 'pickup';

    const pickupSteps = [
        'pending_confirmation',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'completed',
    ];

    const deliverySteps = [
        'pending_confirmation',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'picked_up',
        'delivering',
        'completed',
    ];

    const steps = isPickup ? pickupSteps : deliverySteps;
    const index = steps.indexOf(status);

    return index >= 0 ? index : 0;
}

/**
 * Terminal statuses where tracking is no longer meaningful.
 * These orders should show "Pesan Lagi" instead of "Lacak Pesanan".
 */
export const terminalOrderStatuses = [
    'completed',
    'cancelled_by_customer',
    'cancelled_by_outlet',
    'rejected_by_outlet',
    'failed_delivery',
    'expired',
] as const;

export function isTerminalOrder(status: string): boolean {
    return (terminalOrderStatuses as readonly string[]).includes(status);
}

export type OrderActionType = 'track' | 'reorder';

/**
 * Returns the primary CTA action for a given order status.
 *
 * - Active orders (in-progress) → 'track' (Lacak Pesanan)
 * - Terminal orders (completed/cancelled/failed/expired) → 'reorder' (Pesan Lagi)
 */
export function getOrderPrimaryAction(status: string): OrderActionType {
    return isTerminalOrder(status) ? 'reorder' : 'track';
}
