export const activeOrderStatuses = ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'] as const;
export const historyOrderStatuses = ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'] as const;

export const orderStatusLabels: Record<string, string> = {
    pending_confirmation: 'Menunggu Konfirmasi',
    confirmed: 'Diterima Outlet',
    preparing: 'Sedang Disiapkan',
    ready_for_pickup: 'Siap Diambil',
    picked_up: 'Sudah Diambil Kurir',
    delivering: 'Dalam Perjalanan',
    completed: 'Selesai',
    cancelled_by_customer: 'Dibatalkan Customer',
    cancelled_by_outlet: 'Dibatalkan Outlet',
    rejected_by_outlet: 'Ditolak Outlet',
    failed_delivery: 'Pengiriman Gagal',
    expired: 'Kadaluarsa',
};

export const orderStatusTone: Record<string, string> = {
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

export const deliveryStatusLabels: Record<string, string> = {
    waiting_assignment: 'Menunggu kurir',
    waiting_pickup: 'Kurir menuju outlet',
    picked_up: 'Sudah diambil kurir',
    delivering: 'Sedang diantar',
    completed: 'Terkirim',
    failed: 'Pengiriman gagal',
    retry_delivery: 'Dikirim ulang',
    returned_to_outlet: 'Kembali ke outlet',
    cancelled_and_released: 'Dibatalkan',
};

export function orderStatusLabel(status?: string | null) {
    if (!status) {
        return '-';
    }

    return orderStatusLabels[status] ?? status.replaceAll('_', ' ');
}

export function deliveryStatusLabel(status?: string | null) {
    if (!status) {
        return '-';
    }

    return deliveryStatusLabels[status] ?? status.replaceAll('_', ' ');
}

export function orderProgressIndex(status?: string | null) {
    const steps = ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering', 'completed'];
    const index = steps.indexOf(status ?? '');

    return {
        steps,
        index: index < 0 ? 0 : index,
    };
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
