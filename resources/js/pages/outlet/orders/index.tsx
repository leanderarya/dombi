import { Head, Link, router } from '@inertiajs/react';
import { Package } from 'lucide-react';
import { useState } from 'react';
import Pagination from '@/components/pagination';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import OutletLayout from '@/layouts/outlet-layout';
import { useOrderAlert } from '@/hooks/use-order-alert';
import { formatCurrency, formatRelativeDate } from '@/lib/format';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'pending_confirmation', label: 'Menunggu' },
    { key: 'confirmed', label: 'Diterima' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'ready_for_pickup', label: 'Siap Ambil' },
    { key: 'completed', label: 'Selesai' },
    { key: 'cancelled_by_outlet', label: 'Dibatalkan' },
];

const statusDotColors: Record<string, string> = {
    pending_confirmation: 'bg-amber-400',
    confirmed: 'bg-blue-400',
    preparing: 'bg-orange-400',
    ready_for_pickup: 'bg-emerald-400',
    completed: 'bg-zinc-400',
    cancelled_by_customer: 'bg-red-400',
    cancelled_by_outlet: 'bg-red-400',
    rejected_by_outlet: 'bg-red-400',
    failed_delivery: 'bg-red-400',
    expired: 'bg-zinc-300',
};

const statusLabels: Record<string, string> = {
    pending_confirmation: 'Menunggu',
    confirmed: 'Diterima',
    preparing: 'Disiapkan',
    ready_for_pickup: 'Siap',
    completed: 'Selesai',
    cancelled_by_customer: 'Batal',
    cancelled_by_outlet: 'Batal',
    rejected_by_outlet: 'Ditolak',
    failed_delivery: 'Gagal',
    expired: 'Kadaluarsa',
};

function getWaitMinutes(orderedAt: string): number {
    return Math.floor((Date.now() - new Date(orderedAt).getTime()) / 60000);
}

export default function OutletOrdersIndex({ outlet, orders, filters }: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');
    const { pendingCount } = useOrderAlert();

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

            {/* Urgency Banner */}
            {pendingCount > 0 && (
                <button
                    onClick={() => handleFilterChange('pending_confirmation')}
                    className="mt-4 w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-left text-sm transition-colors hover:bg-amber-100 active:bg-amber-200"
                >
                    <span className="font-semibold text-amber-800">
                        {pendingCount} pesanan menunggu konfirmasi
                    </span>
                    <span className="ml-1 text-amber-600">&rarr;</span>
                </button>
            )}

            <div className="mt-4">
            {orders.data.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title="Belum ada pesanan"
                    description={activeFilter ? 'Tidak ada pesanan dengan filter ini.' : 'Pesanan akan muncul saat customer memesan.'}
                    action={activeFilter ? { label: 'Reset Filter', onClick: () => handleFilterChange('') } : undefined}
                />
            ) : (
                <div className="space-y-1.5">
                    {orders.data.map((order: any) => {
                        const dotColor = statusDotColors[order.status] ?? 'bg-zinc-400';
                        const statusLabel = statusLabels[order.status] ?? order.status;
                        const isPending = order.status === 'pending_confirmation';
                        const waitMin = order.ordered_at ? getWaitMinutes(order.ordered_at) : null;
                        const isUrgent = isPending && waitMin !== null && waitMin > 15;

                        return (
                            <Link
                                key={order.id}
                                href={`/outlet/orders/${order.id}`}
                                className="block rounded-xl border border-border bg-white px-3.5 py-2.5 transition-all hover:shadow-sm active:opacity-80"
                            >
                                {/* Row 1: Code + Fulfillment + Status */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-bold tabular-nums text-text">{order.order_code}</span>
                                        <span className="text-[11px] text-text-subtle">{order.fulfillment_type === 'pickup' ? 'Pickup' : 'Delivery'}</span>
                                        {isPending && (
                                            <span className={`h-1.5 w-1.5 rounded-full ${isUrgent ? 'bg-danger animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                                        )}
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                                        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                                        {statusLabel}
                                    </span>
                                </div>

                                {/* Row 2: Customer · Items · Time · Total */}
                                <div className="mt-1 flex items-center justify-between text-xs">
                                    <span className="text-text-muted truncate">
                                        {order.customer_name}
                                        <span className="mx-1 text-text-subtle">·</span>
                                        {order.items?.length ?? 0} item
                                        {order.ordered_at && (
                                            <>
                                                <span className="mx-1 text-text-subtle">·</span>
                                                <span className={isUrgent ? 'font-semibold text-danger' : 'text-text-subtle'}>
                                                    {formatRelativeDate(order.ordered_at)}
                                                </span>
                                            </>
                                        )}
                                    </span>
                                    <span className="shrink-0 ml-2 text-xs font-semibold text-text tabular-nums">{formatCurrency(order.total)}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
            </div>
            <Pagination links={orders.links} />
        </OutletLayout>
    );
}
