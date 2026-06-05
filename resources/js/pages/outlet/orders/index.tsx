import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import OrderStatusBadge from '@/components/order-status-badge';
import Pagination from '@/components/pagination';
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
                    icon="📦"
                    title="Belum ada pesanan"
                    description={activeFilter ? 'Tidak ada pesanan dengan filter ini.' : 'Pesanan akan muncul saat customer memesan.'}
                    action={activeFilter ? { label: 'Reset Filter', onClick: () => handleFilterChange('') } : undefined}
                />
            ) : (
                <div className="space-y-2">
                    {orders.data.map((order: any) => (
                        <Link
                            key={order.id}
                            href={`/outlet/orders/${order.id}`}
                            className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors active:bg-zinc-50"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold tabular-nums text-slate-900">{order.order_code}</div>
                                    <div className="mt-0.5 text-sm text-slate-600">{order.customer_name}</div>
                                </div>
                                <OrderStatusBadge status={order.status} />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                <span>{order.items?.length ?? 0} item · {formatCurrency(order.total)}</span>
                                <span>{formatDate(order.created_at)}</span>
                            </div>
                            {order.status === 'pending_confirmation' && (
                                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    Perlu konfirmasi
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            )}
            <Pagination links={orders.links} />
        </OutletLayout>
    );
}
