import { getOrderStatus } from '@/lib/status-labels';

const chipStyles: Record<string, string> = {
    pending: 'bg-warning-bg text-warning-text border-warning-border',
    confirmed: 'bg-info-bg text-info-text border-info-border',
    preparing:
        'bg-status-progress-bg text-status-progress border-status-progress-border',
    ready_for_pickup:
        'bg-status-active-bg text-status-active border-status-active-border',
    picked_up:
        'bg-status-transit-bg text-status-transit border-status-transit-border',
    delivering: 'bg-info-bg text-info-text border-info-border',
    completed: 'bg-success-bg text-success-text border-success-border',
    cancelled: 'bg-surface-muted text-text-muted border-border',
    cancelled_by_customer: 'bg-danger-bg text-danger-text border-danger-border',
    cancelled_by_outlet: 'bg-danger-bg text-danger-text border-danger-border',
    failed_delivery: 'bg-danger-bg text-danger-text border-danger-border',
    failed: 'bg-danger-bg text-danger-text border-danger-border',
};

export default function OrderStatusChip({ status }: { status: string }) {
    const style = chipStyles[status] ?? chipStyles.pending;
    const { label } = getOrderStatus(status);

    return (
        <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-bold tracking-wide uppercase ${style}`}
        >
            {label}
        </span>
    );
}
