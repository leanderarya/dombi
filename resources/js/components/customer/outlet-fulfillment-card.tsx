import { orderStatusLabel, orderStatusTone } from '@/lib/customer-status';

interface Props {
    status: string;
    outletName?: string | null;
    deliveryMessage?: string | null;
}

const heroMessages: Record<string, string> = {
    pending: 'Menunggu konfirmasi outlet',
    confirmed: 'Order diterima, segera disiapkan',
    preparing: 'Sedang disiapkan di outlet',
    ready_for_pickup: 'Siap diambil kurir',
    picked_up: 'Kurir menuju lokasi kamu',
    delivering: 'Dalam perjalanan ke alamat kamu',
    completed: 'Pesanan telah diterima',
    cancelled: 'Pesanan dibatalkan',
    failed: 'Pengiriman gagal',
};

export default function OutletFulfillmentCard({ status, outletName, deliveryMessage }: Props) {
    const tone = orderStatusTone[status] ?? 'bg-zinc-50 text-zinc-800 ring-zinc-200';
    const message = deliveryMessage || heroMessages[status] || 'Memproses pesanan';

    return (
        <div className="rounded-lg border border-zinc-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${tone}`}>
                    {orderStatusLabel(status)}
                </span>
                {outletName && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="font-medium">{outletName}</span>
                    </div>
                )}
            </div>
            <div className="mt-3">
                <div className="text-lg font-bold text-slate-900">{message}</div>
                <div className="mt-1 text-xs text-slate-500">Susu kambing segar langsung dari outlet terdekat.</div>
            </div>
        </div>
    );
}
