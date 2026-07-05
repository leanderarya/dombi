import { Head, Link, router } from '@inertiajs/react';
import { Package } from 'lucide-react';
import { useState } from 'react';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import Pagination from '@/components/ui/pagination';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import { useOrderAlert } from '@/hooks/use-order-alert';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatRelativeDate } from '@/lib/format';
import { getOrderStatus } from '@/lib/status-labels';

const operationalFilters = [
    { key: '', label: 'Semua' },
    { key: 'pending_confirmation', label: 'Menunggu' },
    { key: 'confirmed', label: 'Diterima' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'ready_for_pickup', label: 'Siap Ambil' },
    { key: 'delivering', label: 'Dikirim' },
];

const historyFilters = [
    { key: '', label: 'Semua' },
    { key: 'completed', label: 'Selesai' },
    { key: 'cancelled_by_outlet', label: 'Dibatalkan' },
    { key: 'rejected_by_outlet', label: 'Ditolak' },
    { key: 'failed_delivery', label: 'Gagal' },
    { key: 'expired', label: 'Kadaluarsa' },
];

const statusDotColors: Record<string, string> = {
    pending_confirmation: 'bg-amber-400',
    confirmed: 'bg-blue-400',
    preparing: 'bg-orange-400',
    ready_for_pickup: 'bg-emerald-400',
    picked_up: 'bg-emerald-500',
    delivering: 'bg-indigo-400',
    completed: 'bg-zinc-400',
    cancelled_by_customer: 'bg-red-400',
    cancelled_by_outlet: 'bg-red-400',
    rejected_by_outlet: 'bg-red-400',
    failed_delivery: 'bg-red-400',
    expired: 'bg-zinc-300',
};

function getWaitMinutes(orderedAt: string): number {
    return Math.floor((Date.now() - new Date(orderedAt).getTime()) / 60000);
}

export default function OutletOrdersIndex({ outlet, orders, filters, tab, pendingCount }: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');
    const { pendingCount: livePendingCount } = useOrderAlert();
    const count = pendingCount ?? livePendingCount;

    const handleTabChange = (newTab: string) => {
        router.get('/outlet/orders', { tab: newTab }, { preserveState: false, replace: true });
    };

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get('/outlet/orders', { tab, status: key || undefined }, { preserveState: true, replace: true });
    };

    const isAktif = tab !== 'riwayat';
    const filterOptions = isAktif ? operationalFilters : historyFilters;

    return (
        <OutletLayout
            title="Pesanan"
            subtitle={outlet.name}
            headerBelow={
                <div className="space-y-3">
                    {/* Segmented Control */}
                    <div className="flex rounded-xl bg-surface-muted p-1 mx-1">
                        <button
                            onClick={() => handleTabChange('aktif')}
                            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                                isAktif ? 'bg-white shadow-sm text-text' : 'text-text-muted'
                            }`}
                        >
                            Aktif{count > 0 ? ` (${count})` : ''}
                        </button>
                        <button
                            onClick={() => handleTabChange('riwayat')}
                            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                                !isAktif ? 'bg-white shadow-sm text-text' : 'text-text-muted'
                            }`}
                        >
                            Riwayat
                        </button>
                    </div>

                    {/* Filter Chips */}
                    <FilterChips options={filterOptions} active={activeFilter} onChange={handleFilterChange} />
                </div>
            }
        >
            <Head title="Pesanan" />
            <OutletPageShell>
            {/* Urgency Banner — only on Aktif tab */}
            {isAktif && count > 0 && (
                <button
                    onClick={() => handleFilterChange('pending_confirmation')}
                    className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-left text-sm transition-colors hover:bg-amber-100 active:bg-amber-200"
                >
                    <span className="font-semibold text-amber-800">
                        {count} pesanan menunggu konfirmasi
                    </span>
                    <span className="ml-1 text-amber-600">&rarr;</span>
                </button>
            )}

            {orders.data.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title={isAktif ? 'Tidak ada pesanan aktif' : 'Belum ada riwayat'}
                    description={activeFilter ? 'Tidak ada pesanan dengan filter ini.' : isAktif ? 'Pesanan akan muncul saat customer memesan.' : 'Riwayat pesanan akan muncul di sini.'}
                    action={activeFilter ? { label: 'Reset Filter', onClick: () => handleFilterChange('') } : undefined}
                />
            ) : (
                <div className="space-y-2">
                    {orders.data.map((order: any) => {
                        const dotColor = statusDotColors[order.status] ?? 'bg-zinc-400';
                        const statusLabel = getOrderStatus(order.status).label;
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
            <Pagination links={orders.links} />
            </OutletPageShell>
        </OutletLayout>
    );
}
