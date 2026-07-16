/**
 * Centralized status label and color mappings for Dombi.
 * Use this across all Owner, Outlet, Courier, and Customer pages.
 */

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusConfig {
    label: string;
    variant: StatusVariant;
}

// ─── ORDER STATUSES ────────────────────────────────────────────

const ORDER_STATUSES: Record<string, StatusConfig> = {
    pending_confirmation: { label: 'Menunggu Konfirmasi', variant: 'warning' },
    pending_payment: { label: 'Menunggu Pembayaran', variant: 'warning' },
    confirmed: { label: 'Diterima', variant: 'info' },
    preparing: { label: 'Disiapkan', variant: 'info' },
    ready_for_pickup: { label: 'Siap Diambil', variant: 'info' },
    picked_up: { label: 'Diambil Kurir', variant: 'info' },
    delivering: { label: 'Dalam Pengiriman', variant: 'info' },
    completed: { label: 'Selesai', variant: 'success' },
    rejected_by_outlet: { label: 'Ditolak Outlet', variant: 'danger' },
    cancelled_by_customer: { label: 'Dibatalkan Customer', variant: 'neutral' },
    cancelled_by_outlet: { label: 'Dibatalkan Outlet', variant: 'neutral' },
    failed_delivery: { label: 'Pengiriman Gagal', variant: 'danger' },
    expired: { label: 'Kadaluarsa', variant: 'neutral' },
    payment_failed: { label: 'Pembayaran Gagal', variant: 'danger' },
    pending_confirmation_payment_failed: {
        label: 'Pembayaran Gagal',
        variant: 'danger',
    },
};

// ─── DELIVERY STATUSES ─────────────────────────────────────────

const DELIVERY_STATUSES: Record<string, StatusConfig> = {
    waiting_assignment: { label: 'Menunggu Assignment', variant: 'warning' },
    waiting_pickup: { label: 'Menunggu Pickup', variant: 'warning' },
    picked_up: { label: 'Diambil Kurir', variant: 'info' },
    delivering: { label: 'Dalam Pengiriman', variant: 'info' },
    completed: { label: 'Selesai', variant: 'success' },
    failed: { label: 'Gagal', variant: 'danger' },
    retry_delivery: { label: 'Coba Ulang', variant: 'warning' },
    returned_to_outlet: { label: 'Dikembalikan', variant: 'neutral' },
    cancelled_and_released: { label: 'Dibatalkan', variant: 'neutral' },
};

// ─── RESTOCK STATUSES ──────────────────────────────────────────

const RESTOCK_STATUSES: Record<string, StatusConfig> = {
    requested: { label: 'Diminta', variant: 'warning' },
    approved: { label: 'Disetujui', variant: 'info' },
    preparing: { label: 'Disiapkan', variant: 'info' },
    shipped: { label: 'Dikirim', variant: 'info' },
    received: { label: 'Diterima', variant: 'success' },
    rejected: { label: 'Ditolak', variant: 'danger' },
    completed: { label: 'Selesai', variant: 'success' },
};

// ─── DISTRIBUTION STATUSES ─────────────────────────────────────

const DISTRIBUTION_STATUSES: Record<string, StatusConfig> = {
    preparing: { label: 'Disiapkan', variant: 'warning' },
    shipped: { label: 'Dikirim', variant: 'info' },
    received: { label: 'Diterima', variant: 'success' },
    completed: { label: 'Selesai', variant: 'success' },
};

// ─── RETURN STATUSES ──────────────────────────────────────────

const RETURN_STATUSES: Record<string, StatusConfig> = {
    draft: { label: 'Draft', variant: 'neutral' },
    submitted: { label: 'Diajukan', variant: 'warning' },
    approved: { label: 'Disetujui', variant: 'info' },
    rejected: { label: 'Ditolak', variant: 'danger' },
    received_at_center: { label: 'Diterima Pusat', variant: 'info' },
    completed: { label: 'Selesai', variant: 'success' },
};

// ─── EXCHANGE STATUSES ────────────────────────────────────────

const EXCHANGE_STATUSES: Record<string, StatusConfig> = {
    submitted: { label: 'Diajukan', variant: 'warning' },
    approved: { label: 'Disetujui', variant: 'info' },
    rejected: { label: 'Ditolak', variant: 'danger' },
    preparing: { label: 'Disiapkan', variant: 'info' },
    shipped: { label: 'Dikirim', variant: 'info' },
    received: { label: 'Diterima', variant: 'success' },
    completed: { label: 'Selesai', variant: 'success' },
};

// ─── STOCK STATUSES ──────────────────────────────────────────

const CUSTOMER_STOCK_STATUSES: Record<string, StatusConfig> = {
    out_of_stock: { label: 'Habis', variant: 'danger' },
    low: { label: 'Stok Terbatas', variant: 'warning' },
    available: { label: 'Tersedia', variant: 'success' },
};

const OWNER_STOCK_STATUSES: Record<string, StatusConfig> = {
    out_of_stock: { label: 'Stok Habis', variant: 'danger' },
    low: { label: 'Stok Rendah', variant: 'warning' },
    available: { label: 'Sehat', variant: 'success' },
};

// ─── HELPERS ───────────────────────────────────────────────────

/**
 * Merged status map for auto-detection (order takes precedence for shared keys like 'preparing').
 * Used by StatusBadge component.
 */
export const ALL_STATUSES: Record<string, StatusConfig> = {
    ...EXCHANGE_STATUSES,
    ...RETURN_STATUSES,
    ...DISTRIBUTION_STATUSES,
    ...RESTOCK_STATUSES,
    ...DELIVERY_STATUSES,
    ...ORDER_STATUSES,
};

export function getOrderStatus(status: string): StatusConfig {
    return (
        ORDER_STATUSES[status] ?? {
            label: status.replaceAll('_', ' '),
            variant: 'neutral',
        }
    );
}

export function getDeliveryStatus(status: string): StatusConfig {
    return (
        DELIVERY_STATUSES[status] ?? {
            label: status.replaceAll('_', ' '),
            variant: 'neutral',
        }
    );
}

export function getRestockStatus(status: string): StatusConfig {
    return (
        RESTOCK_STATUSES[status] ?? {
            label: status.replaceAll('_', ' '),
            variant: 'neutral',
        }
    );
}

export function getDistributionStatus(status: string): StatusConfig {
    return (
        DISTRIBUTION_STATUSES[status] ?? {
            label: status.replaceAll('_', ' '),
            variant: 'neutral',
        }
    );
}

export function getReturnStatus(status: string): StatusConfig {
    return (
        RETURN_STATUSES[status] ?? {
            label: status.replaceAll('_', ' '),
            variant: 'neutral',
        }
    );
}

export function getExchangeStatus(status: string): StatusConfig {
    return (
        EXCHANGE_STATUSES[status] ?? {
            label: status.replaceAll('_', ' '),
            variant: 'neutral',
        }
    );
}

export function getCustomerStockStatus(
    status: string,
    availableStock?: number,
): StatusConfig & { displayLabel: string } {
    const config = CUSTOMER_STOCK_STATUSES[status] ?? {
        label: status,
        variant: 'neutral',
    };
    let displayLabel = config.label;

    if (status === 'low' && availableStock !== undefined) {
        displayLabel = `Stok Terbatas (${availableStock})`;
    }

    return { ...config, displayLabel };
}

export function getOwnerStockStatus(
    status: string,
    availableStock?: number,
): StatusConfig & { displayLabel: string } {
    const config = OWNER_STOCK_STATUSES[status] ?? {
        label: status,
        variant: 'neutral',
    };
    let displayLabel = config.label;

    if (availableStock !== undefined) {
        displayLabel = `${config.label} (${availableStock})`;
    }

    return { ...config, displayLabel };
}

// ─── ORDER STATUS TONE (ring badge classes) ────────────────────

const ORDER_STATUS_TONE: Record<string, string> = {
    pending_confirmation: 'bg-amber-50 text-amber-800 ring-amber-200',
    confirmed: 'bg-blue-50 text-blue-800 ring-blue-200',
    preparing: 'bg-orange-50 text-orange-800 ring-orange-200',
    ready_for_pickup: 'bg-purple-50 text-purple-800 ring-purple-200',
    picked_up: 'bg-blue-50 text-blue-800 ring-blue-200',
    delivering: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    cancelled_by_customer: 'bg-red-50 text-red-800 ring-red-200',
    cancelled_by_outlet: 'bg-red-50 text-red-800 ring-red-200',
    rejected_by_outlet: 'bg-red-50 text-red-800 ring-red-200',
    failed_delivery: 'bg-red-50 text-red-800 ring-red-200',
    expired: 'bg-slate-50 text-slate-800 ring-slate-200',
};

export function getOrderStatusTone(status: string): string {
    return (
        ORDER_STATUS_TONE[status] ??
        'bg-surface-muted text-text-muted ring-border'
    );
}

export type { StatusConfig, StatusVariant };
export type { StockStatus } from './stock';
