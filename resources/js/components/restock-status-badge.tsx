import { getRestockStatus } from '@/lib/status-labels';

const styles: Record<string, string> = {
    requested: 'bg-yellow-100 text-yellow-800',
    rejected: 'bg-red-100 text-red-800',
    preparing: 'bg-purple-100 text-purple-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-green-100 text-green-800',
};

export default function RestockStatusBadge({ status }: { status: string }) {
    const { label } = getRestockStatus(status);

    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? styles.requested}`}>{label}</span>;
}
