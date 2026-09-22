/* ------------------------------------------------------------------ */
/*  Single source of truth for order status labels + tone               */
/* ------------------------------------------------------------------ */

import type { BadgeVariant } from '@/components/ui/status-badge';

interface StatusConfig {
    label: string;
    variant: BadgeVariant;
    reason?: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
    // Active statuses
    pending_confirmation: {
        label: 'Menunggu Konfirmasi',
        variant: 'warning',
    },
    awaiting_preparation: {
        label: 'Menunggu Disiapkan',
        variant: 'warning',
    },
    pending_payment: {
        label: 'Menunggu Pembayaran',
        variant: 'warning',
    },
    confirmed: {
        label: 'Diterima',
        variant: 'info',
    },
    preparing: {
        label: 'Disiapkan',
        variant: 'info',
    },
    ready_for_pickup: {
        label: 'Siap Diambil',
        variant: 'info',
    },
    picked_up: {
        label: 'Diambil Kurir',
        variant: 'info',
    },
    delivering: {
        label: 'Dalam Pengiriman',
        variant: 'info',
    },

    // History / terminal statuses
    completed: {
        label: 'Selesai',
        variant: 'success',
    },
    cancelled_by_customer: {
        label: 'Dibatalkan Customer',
        variant: 'danger',
        reason: 'Dibatalkan oleh Anda',
    },
    cancelled_by_outlet: {
        label: 'Dibatalkan Outlet',
        variant: 'danger',
        reason: 'Dibatalkan oleh outlet',
    },
    rejected_by_outlet: {
        label: 'Ditolak Outlet',
        variant: 'danger',
        reason: 'Ditolak oleh outlet',
    },
    failed_delivery: {
        label: 'Pengiriman Gagal',
        variant: 'danger',
        reason: 'Pengiriman gagal',
    },
    expired: {
        label: 'Kadaluarsa',
        variant: 'neutral',
        reason: 'Pesanan tidak diselesaikan dalam batas waktu',
    },
};

const FALLBACK: StatusConfig = {
    label: 'Unknown',
    variant: 'neutral',
};

/**
 * Get status label + tone for an order status.
 */
export function getOrderStatusConfig(status: string): StatusConfig {
    return (
        STATUS_CONFIG[status] ?? {
            ...FALLBACK,
            label: status.replaceAll('_', ' '),
        }
    );
}

/**
 * Terminal statuses — non-clickable, muted visual state.
 */
export const TERMINAL_STATUSES = [
    'expired',
    'cancelled_by_customer',
    'cancelled_by_outlet',
    'rejected_by_outlet',
];

/**
 * Check if an order status is terminal (dead).
 */
export function isTerminalStatus(status: string): boolean {
    return TERMINAL_STATUSES.includes(status);
}
