import { Head, Link, router } from '@inertiajs/react';
import { Package } from 'lucide-react';
import { useState } from 'react';
import Pagination from '@/components/pagination';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'pending_confirmation', label: 'Menunggu' },
    { key: 'confirmed', label: 'Diterima' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'ready_for_pickup', label: 'Siap Ambil' },
    { key: 'completed', label: 'Selesai' },
    { key: 'cancelled_by_outlet', label: 'Dibatalkan' },
];

const statusStyles: Record<string, { bg: string; dot: string; label: string }> = {
    pending_confirmation: { bg: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400', label: 'Menunggu' },
    confirmed: { bg: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400', label: 'Diterima' },
    preparing: { bg: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400', label: 'Disiapkan' },
    ready_for_pickup: { bg: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400', label: 'Siap' },
    completed: { bg: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400', label: 'Selesai' },
    cancelled_by_customer: { bg: 'bg-red-50 text-red-600', dot: 'bg-red-400', label: 'Batal' },
    cancelled_by_outlet: { bg: 'bg-red-50 text-red-600', dot: 'bg-red-400', label: 'Batal' },
    rejected_by_outlet: { bg: 'bg-red-50 text-red-600', dot: 'bg-red-400', label: 'Ditolak' },
    failed_delivery: { bg: 'bg-red-50 text-red-600', dot: 'bg-red-400', label: 'Gagal' },
    expired: { bg: 'bg-zinc-100 text-zinc-500', dot: 'bg-zinc-300', label: 'Kadaluarsa' },
};

export default function OutletOrdersIndex({ outlet, orders, filters }: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get('/outlet/orders', { status: key || undefined }, { preserveState: true, replace: true });
    };

    return (
        <OutletLayout
            title="Pesanan"
            subtitle={outlet.name}
            headerBelow={
                <FilterChips options={statusFilters} active={activeFilter} onChange={handleFilterChange} />
            }
        >
            <Head title="Pesanan" />

            {orders.data.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title="Belum ada pesanan"
                    description={activeFilter ? 'Tidak ada pesanan dengan filter ini.' : 'Pesanan akan muncul saat customer memesan.'}
                    action={activeFilter ? { label: 'Reset Filter', onClick: () => handleFilterChange('') } : undefined}
                />
            ) : (
                <div className="space-y-3">
                    {orders.data.map((order: any) => {
                        const st = statusStyles[order.status] ?? statusStyles.failed_delivery;
                        const isPending = order.status === 'pending_confirmation';

                        return (
                            <Link
                                key={order.id}
                                href={`/outlet/orders/${order.id}`}
                                className={`group block rounded-xl border bg-white p-4 transition-all duration-200 hover:shadow-sm active:scale-[0.99] ${
                                    isPending ? 'border-amber-200' : 'border-border hover:border-border-strong'
                                }`}
                            >
                                {/* Row 1: Code + Status */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-bold tabular-nums text-text">{order.order_code}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                            order.fulfillment_type === 'pickup'
                                                ? 'bg-blue-50 text-blue-600'
                                                : 'bg-purple-50 text-purple-600'
                                        }`}>
                                            {order.fulfillment_type === 'pickup' ? 'Pickup' : 'Delivery'}
                                        </span>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.bg}`}>
                                        <span className={`h-1 w-1 rounded-full ${st.dot}`} />
                                        {st.label}
                                    </span>
                                </div>

                                {/* Row 2: Customer + Meta */}
                                <div className="mt-2 flex items-center justify-between text-xs">
                                    <span className="font-medium text-text-muted truncate">{order.customer_name}</span>
                                    <span className="text-text-subtle shrink-0 ml-2">{formatDate(order.created_at)}</span>
                                </div>

                                {/* Row 3: Items + Total */}
                                <div className="mt-1.5 flex items-center justify-between text-xs text-text-subtle">
                                    <span>{order.items?.length ?? 0} item</span>
                                    <span className="font-semibold text-text tabular-nums">{formatCurrency(order.total)}</span>
                                </div>

                                {/* Pending indicator */}
                                {isPending && (
                                    <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700">
                                        <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                                        Perlu konfirmasi sekarang
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </div>
            )}
            <Pagination links={orders.links} />
        </OutletLayout>
    );
}
