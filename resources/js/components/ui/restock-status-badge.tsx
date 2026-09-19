import { getRestockStatus } from '@/lib/status-labels';

const styles: Record<string, string> = {
    requested: 'bg-warning-bg text-warning-text ring-1 ring-inset ring-warning/10',
    rejected: 'bg-danger-bg text-danger-text ring-1 ring-inset ring-danger/10',
    preparing: 'bg-warning-bg text-warning-text ring-1 ring-inset ring-warning/10',
    shipped: 'bg-warning-bg text-warning-text ring-1 ring-inset ring-warning/10',
    completed: 'bg-success-bg text-success-text ring-1 ring-inset ring-success/10',
    cancelled:
        'bg-surface-muted text-text ring-1 ring-inset ring-text-muted/10',
    approved: 'bg-warning-bg text-warning-text ring-1 ring-inset ring-warning/10',
};

export default function RestockStatusBadge({ status }: { status: string }) {
    const { label } = getRestockStatus(status);

    return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? styles.requested}`}>{label}</span>;
}
