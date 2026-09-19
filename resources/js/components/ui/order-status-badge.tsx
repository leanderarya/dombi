const styles: Record<string, string> = {
    pending_confirmation:
        'bg-warning-bg text-warning-text ring-1 ring-warning-border',
    confirmed: 'bg-info-bg text-info-text ring-1 ring-info-border',
    preparing:
        'bg-status-progress-bg text-status-progress ring-1 ring-status-progress-border',
    ready_for_pickup:
        'bg-status-active-bg text-status-active ring-1 ring-status-active-border',
    picked_up: 'bg-info-bg text-info-text ring-1 ring-info-border',
    delivering:
        'bg-status-transit-bg text-status-transit ring-1 ring-status-transit-border',
    completed: 'bg-success-bg text-success-text ring-1 ring-success-border',
    cancelled_by_customer: 'bg-danger-bg text-danger-text ring-1 ring-danger-border',
    cancelled_by_outlet: 'bg-danger-bg text-danger-text ring-1 ring-danger-border',
    rejected_by_outlet: 'bg-danger-bg text-danger-text ring-1 ring-danger-border',
    failed_delivery: 'bg-danger-bg text-danger-text ring-1 ring-danger-border',
    expired: 'bg-surface-muted text-text ring-1 ring-border',
};

const labels: Record<string, string> = {
    pending_confirmation: 'Menunggu Konfirmasi',
    confirmed: 'Diterima',
    preparing: 'Disiapkan',
    ready_for_pickup: 'Siap Diambil',
    picked_up: 'Sudah Diambil',
    delivering: 'Dalam Pengiriman',
    completed: 'Selesai',
    cancelled_by_customer: 'Dibatalkan Customer',
    cancelled_by_outlet: 'Dibatalkan Outlet',
    rejected_by_outlet: 'Ditolak Outlet',
    failed_delivery: 'Pengiriman Gagal',
    expired: 'Kadaluarsa',
};

export default function OrderStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? styles.failed_delivery}`}>
            {labels[status] ?? status.replaceAll('_', ' ')}
        </span>
    );
}
