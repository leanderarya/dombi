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

// ─── HELPERS ───────────────────────────────────────────────────

export function getOrderStatus(status: string): StatusConfig {
    return ORDER_STATUSES[status] ?? { label: status.replaceAll('_', ' '), variant: 'neutral' };
}

export function getDeliveryStatus(status: string): StatusConfig {
    return DELIVERY_STATUSES[status] ?? { label: status.replaceAll('_', ' '), variant: 'neutral' };
}

export function getRestockStatus(status: string): StatusConfig {
    return RESTOCK_STATUSES[status] ?? { label: status.replaceAll('_', ' '), variant: 'neutral' };
}

export function getDistributionStatus(status: string): StatusConfig {
    return DISTRIBUTION_STATUSES[status] ?? { label: status.replaceAll('_', ' '), variant: 'neutral' };
}

export function getReturnStatus(status: string): StatusConfig {
    return RETURN_STATUSES[status] ?? { label: status.replaceAll('_', ' '), variant: 'neutral' };
}

export function getExchangeStatus(status: string): StatusConfig {
    return EXCHANGE_STATUSES[status] ?? { label: status.replaceAll('_', ' '), variant: 'neutral' };
}

export type { StatusConfig, StatusVariant };
