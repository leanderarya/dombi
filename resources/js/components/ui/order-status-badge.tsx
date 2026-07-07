const styles: Record<string, string> = {
    pending_confirmation: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    confirmed: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
    preparing: 'bg-orange-50 text-orange-800 ring-1 ring-orange-200',
    ready_for_pickup: 'bg-purple-50 text-purple-800 ring-1 ring-purple-200',
    picked_up: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
    delivering: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200',
    completed: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
    cancelled_by_customer: 'bg-red-50 text-red-800 ring-1 ring-red-200',
    cancelled_by_outlet: 'bg-red-50 text-red-800 ring-1 ring-red-200',
    rejected_by_outlet: 'bg-red-50 text-red-800 ring-1 ring-red-200',
    failed_delivery: 'bg-red-50 text-red-800 ring-1 ring-red-200',
    expired: 'bg-slate-50 text-slate-800 ring-1 ring-slate-200',
};

const labels: Record<string, string> = {
    pending_confirmation: 'Menunggu Konfirmasi',
    confirmed: 'Diterima',
    preparing: 'Disiapkan',
    ready_for_pickup: 'Siap Diambil',
    picked_up: 'Sudah Diambil',
    delivering: 'Dalam Pengiriman',
    completed: 'Selesai',
    cancelled_by_customer: 'Dibatalkan Customer',
    cancelled_by_outlet: 'Dibatalkan Outlet',
    rejected_by_outlet: 'Ditolak Outlet',
    failed_delivery: 'Pengiriman Gagal',
    expired: 'Kadaluarsa',
};

export default function OrderStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? styles.failed_delivery}`}>
            {labels[status] ?? status.replaceAll('_', ' ')}
        </span>
    );
}
