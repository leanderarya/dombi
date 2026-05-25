const styles: Record<string, string> = {
    waiting_assignment: 'bg-zinc-200 text-zinc-800',
    waiting_pickup: 'bg-yellow-100 text-yellow-800',
    picked_up: 'bg-blue-100 text-blue-800',
    delivering: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    retry_delivery: 'bg-orange-100 text-orange-800',
    returned_to_outlet: 'bg-amber-100 text-amber-800',
    cancelled_and_released: 'bg-zinc-300 text-zinc-900',
};

const labels: Record<string, string> = {
    waiting_assignment: 'Waiting Assignment',
    waiting_pickup: 'Waiting Pickup',
    picked_up: 'Picked Up',
    delivering: 'Delivering',
    completed: 'Completed',
    failed: 'Failed',
    retry_delivery: 'Retry Delivery',
    returned_to_outlet: 'Returned to Outlet',
    cancelled_and_released: 'Cancelled & Released',
};

export default function DeliveryStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? styles.waiting_assignment}`}>
            {labels[status] ?? status.replaceAll('_', ' ')}
        </span>
    );
}
