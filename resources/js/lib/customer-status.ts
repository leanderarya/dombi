export const activeOrderStatuses = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'] as const;
export const historyOrderStatuses = ['completed', 'cancelled', 'failed'] as const;

export const orderStatusLabels: Record<string, string> = {
    pending: 'Menunggu konfirmasi',
    confirmed: 'Diterima outlet',
    preparing: 'Sedang disiapkan',
    ready_for_pickup: 'Siap diambil',
    picked_up: 'Sudah diambil',
    delivering: 'Dalam pengiriman',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    failed: 'Gagal',
};

export const orderStatusTone: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 ring-amber-200',
    confirmed: 'bg-blue-50 text-blue-800 ring-blue-200',
    preparing: 'bg-orange-50 text-orange-800 ring-orange-200',
    ready_for_pickup: 'bg-purple-50 text-purple-800 ring-purple-200',
    picked_up: 'bg-blue-50 text-blue-800 ring-blue-200',
    delivering: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    cancelled: 'bg-red-50 text-red-800 ring-red-200',
    failed: 'bg-red-50 text-red-800 ring-red-200',
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
    const steps = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering', 'completed'];
    const index = steps.indexOf(status ?? '');

    return {
        steps,
        index: index < 0 ? 0 : index,
    };
}
