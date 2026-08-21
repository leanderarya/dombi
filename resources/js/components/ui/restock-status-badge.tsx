import { getRestockStatus } from '@/lib/status-labels';

const styles: Record<string, string> = {
    requested: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10',
    rejected: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
    preparing: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10',
    shipped: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10',
    completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10',
    cancelled: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-600/10',
    approved: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10',
};

export default function RestockStatusBadge({ status }: { status: string }) {
    const { label } = getRestockStatus(status);

    return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? styles.requested}`}>{label}</span>;
}
