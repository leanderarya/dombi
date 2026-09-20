interface Props {
    status: string;
    className?: string;
}

const CONFIG: Record<
    string,
    { label: string; dotClass: string; badgeClass: string }
> = {
    overdue: {
        label: 'Terlambat',
        dotClass: 'bg-danger-bg0',
        badgeClass: 'bg-danger-bg text-danger-text border border-danger-border',
    },
    unpaid: {
        label: 'Belum Bayar',
        dotClass: 'bg-warning-bg0',
        badgeClass:
            'bg-warning-bg text-warning-text border border-warning-border',
    },
    partial: {
        label: 'Sebagian',
        dotClass: 'bg-info-bg0',
        badgeClass: 'bg-info-bg text-info-text border border-info-border',
    },
    unsettled: {
        label: 'Belum Ditagihkan',
        dotClass: 'bg-status-progress-bg0',
        badgeClass:
            'bg-status-progress-bg text-status-progress border border-status-progress-border',
    },
    no_activity: {
        label: 'Belum Ada Aktivitas',
        dotClass: 'bg-text-subtle',
        badgeClass: 'bg-surface-muted text-text-muted border border-border',
    },
    paid: {
        label: 'Lunas',
        dotClass: 'bg-success',
        badgeClass:
            'bg-success-bg text-success-text border border-success-border',
    },
};

export default function FinanceStatusBadge({ status, className = '' }: Props) {
    const config = CONFIG[status] ?? CONFIG.no_activity;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.badgeClass} ${className}`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
            {config.label}
        </span>
    );
}

export function getOverdueDays(dueDate: string | null): number {
    if (!dueDate) {
        return 0;
    }

    const due = new Date(dueDate);
    const now = new Date();
    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000));
}
