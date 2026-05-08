const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-orange-100 text-orange-800',
    ready_for_pickup: 'bg-purple-100 text-purple-800',
    picked_up: 'bg-indigo-100 text-indigo-800',
    delivering: 'bg-sky-100 text-sky-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    failed: 'bg-zinc-200 text-zinc-800',
};

export default function OrderStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? styles.failed}`}>
            {status.replaceAll('_', ' ')}
        </span>
    );
}
