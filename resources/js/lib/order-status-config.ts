/* ------------------------------------------------------------------ */
/*  Single source of truth for order status labels + badge classes      */
/* ------------------------------------------------------------------ */

interface StatusConfig {
    label: string;
    className: string;
    reason?: string;
}

const BADGE_BASE = 'rounded-full px-2.5 py-0.5 text-[11px] font-bold';

const STATUS_CONFIG: Record<string, StatusConfig> = {
    // Active statuses
    pending_confirmation: {
        label: 'Menunggu Konfirmasi',
        className: `${BADGE_BASE} bg-amber-50 text-amber-700`,
    },
    pending_payment: {
        label: 'Menunggu Pembayaran',
        className: `${BADGE_BASE} bg-amber-50 text-amber-700`,
    },
    confirmed: {
        label: 'Dikonfirmasi',
        className: `${BADGE_BASE} bg-emerald-50 text-emerald-700`,
    },
    preparing: {
        label: 'Disiapkan',
        className: `${BADGE_BASE} bg-orange-50 text-orange-700`,
    },
    ready_for_pickup: {
        label: 'Siap Diambil',
        className: `${BADGE_BASE} bg-blue-50 text-blue-700`,
    },
    picked_up: {
        label: 'Diambil Kurir',
        className: `${BADGE_BASE} bg-purple-50 text-purple-700`,
    },
    delivering: {
        label: 'Dikirim',
        className: `${BADGE_BASE} bg-purple-50 text-purple-700`,
    },

    // History / terminal statuses
    completed: {
        label: 'Selesai',
        className: `${BADGE_BASE} bg-emerald-50 text-emerald-700`,
    },
    cancelled_by_customer: {
        label: 'Dibatalkan',
        className: `${BADGE_BASE} bg-red-50 text-red-700`,
        reason: 'Dibatalkan oleh Anda',
    },
    cancelled_by_outlet: {
        label: 'Dibatalkan',
        className: `${BADGE_BASE} bg-red-50 text-red-700`,
        reason: 'Dibatalkan oleh outlet',
    },
    rejected_by_outlet: {
        label: 'Ditolak',
        className: `${BADGE_BASE} bg-red-50 text-red-700`,
        reason: 'Ditolak oleh outlet',
    },
    failed_delivery: {
        label: 'Gagal',
        className: `${BADGE_BASE} bg-amber-50 text-amber-700`,
        reason: 'Pengiriman gagal',
    },
    expired: {
        label: 'Kadaluarsa',
        className: `${BADGE_BASE} bg-gray-100 text-gray-600`,
        reason: 'Outlet tidak konfirmasi tepat waktu',
    },
};

const FALLBACK: StatusConfig = {
    label: 'Unknown',
    className: `${BADGE_BASE} bg-gray-50 text-gray-700`,
};

/**
 * Get status label + badge class for an order status.
 */
export function getOrderStatusConfig(status: string): StatusConfig {
    return STATUS_CONFIG[status] ?? { ...FALLBACK, label: status.replaceAll('_', ' ') };
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
