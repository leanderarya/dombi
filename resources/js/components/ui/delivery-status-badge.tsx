const styles: Record<string, string> = {
    waiting_assignment: 'bg-surface-muted text-text ring-1 ring-border',
    waiting_pickup: 'bg-warning-bg text-warning-text ring-1 ring-warning-border',
    picked_up: 'bg-info-bg text-info-text ring-1 ring-info-border',
    delivering:
        'bg-status-active-bg text-status-active ring-1 ring-status-active-border',
    completed: 'bg-success-bg text-success-text ring-1 ring-success-border',
    failed: 'bg-danger-bg text-danger-text ring-1 ring-danger-border',
    retry_delivery:
        'bg-status-progress-bg text-status-progress ring-1 ring-status-progress-border',
    returned_to_outlet: 'bg-warning-bg text-warning-text ring-1 ring-warning-border',
    cancelled_and_released: 'bg-surface-muted text-text ring-1 ring-border',
};

const labels: Record<string, string> = {
    waiting_assignment: 'Menunggu Assignment',
    waiting_pickup: 'Menunggu Pickup',
    picked_up: 'Sudah Diambil',
    delivering: 'Sedang Diantar',
    completed: 'Selesai',
    failed: 'Gagal',
    retry_delivery: 'Pengiriman Ulang',
    returned_to_outlet: 'Dikembalikan',
    cancelled_and_released: 'Dibatalkan',
};

export default function DeliveryStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? styles.waiting_assignment}`}>
            {labels[status] ?? status.replaceAll('_', ' ')}
        </span>
    );
}
