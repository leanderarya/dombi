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
        dotClass: 'bg-red-500',
        badgeClass: 'bg-red-50 text-red-700 border border-red-200',
    },
    unpaid: {
        label: 'Belum Bayar',
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    },
    partial: {
        label: 'Sebagian',
        dotClass: 'bg-blue-500',
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    },
    unsettled: {
        label: 'Belum Ditagihkan',
        dotClass: 'bg-orange-500',
        badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
    },
    no_activity: {
        label: 'Belum Ada Aktivitas',
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
    },
    paid: {
        label: 'Lunas',
        dotClass: 'bg-emerald-500',
        badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
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
