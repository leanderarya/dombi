import { getDistributionStatus } from '@/lib/status-labels';

const styles: Record<string, string> = {
    preparing: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10',
    shipped: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/10',
    completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10',
};

export default function DistributionStatusBadge({ status }: { status: string }) {
    const { label } = getDistributionStatus(status);

    return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? styles.preparing}`}>{label}</span>;
}
