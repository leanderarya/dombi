const styles: Record<string, string> = {
    waiting_assignment: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200',
    waiting_pickup: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    picked_up: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    delivering: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
    completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    failed: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    retry_delivery: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    returned_to_outlet: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    cancelled_and_released: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200',
};

const labels: Record<string, string> = {
    waiting_assignment: 'Menunggu Assignment',
    waiting_pickup: 'Menunggu Pickup',
    picked_up: 'Sudah Diambil',
    delivering: 'Sedang Diantar',
    completed: 'Selesai',
    failed: 'Gagal',
    retry_delivery: 'Pengiriman Ulang',
    returned_to_outlet: 'Dikembalikan',
    cancelled_and_released: 'Dibatalkan',
};

export default function DeliveryStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? styles.waiting_assignment}`}>
            {labels[status] ?? status.replaceAll('_', ' ')}
        </span>
    );
}
