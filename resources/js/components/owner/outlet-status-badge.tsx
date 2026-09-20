const styles: Record<string, string> = {
    active: 'bg-success-bg text-success-text ring-1 ring-inset ring-success/10',
    inactive:
        'bg-surface-muted text-text-muted ring-1 ring-inset ring-text-muted/10',
    temporarily_closed:
        'bg-warning-bg text-warning-text ring-1 ring-inset ring-warning/10',
    maintenance:
        'bg-status-progress-bg text-status-progress ring-1 ring-inset ring-status-progress/10',
    archived:
        'bg-surface-muted text-text-subtle ring-1 ring-inset ring-text-subtle/10',
    low_stock:
        'bg-warning-bg text-warning-text ring-1 ring-inset ring-warning/10',
    busy: 'bg-status-transit-bg text-status-transit ring-1 ring-inset ring-status-transit/10',
};

const labels: Record<string, string> = {
    active: 'Aktif',
    inactive: 'Nonaktif',
    temporarily_closed: 'Tutup Sementara',
    maintenance: 'Maintenance',
    archived: 'Diarsipkan',
    low_stock: 'Stok Rendah',
    busy: 'Sibuk',
};

export default function OutletStatusBadge({ status }: { status: string }) {
    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? styles.active}`}
        >
            {labels[status] ?? status}
        </span>
    );
}
