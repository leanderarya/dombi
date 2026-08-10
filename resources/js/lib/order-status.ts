export type OrderStatus =
    | 'pending_confirmation'
    | 'confirmed'
    | 'preparing'
    | 'ready_for_pickup'
    | 'picked_up'
    | 'delivering'
    | 'completed'
    | 'cancelled_by_customer'
    | 'cancelled_by_outlet'
    | 'rejected_by_outlet'
    | 'failed_delivery'
    | 'expired';

export type PaymentStatus =
    'unpaid' | 'pending' | 'paid' | 'failed' | 'expired' | 'settled';

export interface NormalizedOrder {
    id: number;
    order_code: string;
    recovery_token?: string | null;
    tracking_url?: string | null;
    status: string;
    payment_status?: string | null;
    fulfillment_type: string;
    total: number;
    subtotal: number;
    delivery_fee: number;
    payment_method: string;
    confirmation_expires_at?: string | null;
    ordered_at?: string | null;
    outlet?: {
        name: string;
        address?: string | null;
        phone?: string | null;
        operating_hours?: string | null;
        latitude?: number | null;
        longitude?: number | null;
    } | null;
    items: {
        product_name: string;
        quantity: number;
        price: number;
        subtotal: number;
        variant_name?: string;
    }[];
    status_histories: {
        to_status: string;
        notes?: string | null;
        created_at?: string | null;
    }[];
    delivery?: {
        courier?: { name: string; vehicle_plate?: string | null } | null;
        external_courier_name?: string | null;
        external_plate_number?: string | null;
        failed_reason?: string | null;
    } | null;
    customer_name?: string | null;
    customer_address?: string | null;
    customer_address_detail?: string | null;
    customer_landmark?: string | null;
    rejection_reason?: string | null;
    rejection_note?: string | null;
    cancellation_reason?: string | null;
    cancellation_note?: string | null;
}

export const ORDER_STATUSES: readonly OrderStatus[] = [
    'pending_confirmation',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'picked_up',
    'delivering',
    'completed',
    'cancelled_by_customer',
    'cancelled_by_outlet',
    'rejected_by_outlet',
    'failed_delivery',
    'expired',
];

export const TERMINAL_STATUSES: readonly OrderStatus[] = [
    'completed',
    'cancelled_by_customer',
    'cancelled_by_outlet',
    'rejected_by_outlet',
    'failed_delivery',
    'expired',
];

export const CANCELLABLE_STATUSES: readonly OrderStatus[] = [
    'pending_confirmation',
];

export function isTerminal(status: string): boolean {
    return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isCancellable(status: string): boolean {
    return (CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

export function getPaymentIssue(
    paymentStatus: string | null | undefined,
): { isFailed: boolean } | null {
    if (paymentStatus === 'failed') {
        return { isFailed: true };
    }

    if (paymentStatus === 'expired') {
        return { isFailed: false };
    }

    return null;
}

export function getBadgeProps(input: {
    status: string;
    paymentStatus?: string | null;
    isPickup: boolean;
}): {
    badgeVariant?: 'info';
    badgeLabel?: string;
    badgeFallbackStatus?: string;
} {
    if (input.status === 'ready_for_pickup' && !input.isPickup) {
        return { badgeVariant: 'info', badgeLabel: 'Menunggu Kurir' };
    }

    if (getPaymentIssue(input.paymentStatus)) {
        return { badgeFallbackStatus: 'payment_failed' };
    }

    if (
        input.status === 'pending_confirmation' &&
        input.paymentStatus !== 'paid'
    ) {
        return { badgeFallbackStatus: 'pending_payment' };
    }

    return { badgeFallbackStatus: input.status };
}

export function normalizeOrder(order: NormalizedOrder): NormalizedOrder {
    return order;
}

const STATUS_LABELS: Record<string, string> = {
    pending_confirmation: 'Menunggu Konfirmasi',
    confirmed: 'Pesanan Dikonfirmasi',
    preparing: 'Pesanan Disiapkan',
    ready_for_pickup: 'Siap Diambil',
    picked_up: 'Pesanan Diambil',
    delivering: 'Pesanan Dikirim',
    completed: 'Pesanan Kamu Sudah Selesai!',
    cancelled_by_customer: 'Pesanan Dibatalkan',
    cancelled_by_outlet: 'Dibatalkan Outlet',
    rejected_by_outlet: 'Pesanan Ditolak',
    failed_delivery: 'Pengiriman Gagal',
    expired: 'Pesanan Kadaluarsa',
};

export function getStatusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status.replaceAll('_', ' ');
}
