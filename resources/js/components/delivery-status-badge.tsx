const styles: Record<string, string> = {
    waiting_assignment: 'bg-zinc-200 text-zinc-800',
    waiting_pickup: 'bg-yellow-100 text-yellow-800',
    picked_up: 'bg-blue-100 text-blue-800',
    delivering: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
};

export default function DeliveryStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? styles.waiting_assignment}`}>
            {status.replaceAll('_', ' ')}
        </span>
    );
}
