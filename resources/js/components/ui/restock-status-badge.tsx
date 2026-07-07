import { getRestockStatus } from '@/lib/status-labels';

const styles: Record<string, string> = {
    requested: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10',
    rejected: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
    preparing: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10',
    shipped: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/10',
    completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10',
};

export default function RestockStatusBadge({ status }: { status: string }) {
    const { label } = getRestockStatus(status);

    return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? styles.requested}`}>{label}</span>;
}
