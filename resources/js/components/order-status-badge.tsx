const styles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    confirmed: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
    preparing: 'bg-orange-50 text-orange-800 ring-1 ring-orange-200',
    ready_for_pickup: 'bg-purple-50 text-purple-800 ring-1 ring-purple-200',
    picked_up: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
    delivering: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200',
    completed: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
    cancelled: 'bg-red-50 text-red-800 ring-1 ring-red-200',
    failed: 'bg-red-50 text-red-800 ring-1 ring-red-200',
};

export default function OrderStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? styles.failed}`}>
            {status.replaceAll('_', ' ')}
        </span>
    );
}
