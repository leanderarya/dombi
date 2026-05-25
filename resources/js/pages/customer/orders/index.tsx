import { Head, Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import ActiveOrderCard from '@/components/customer/active-order-card';
import EmptyOrderState from '@/components/customer/empty-order-state';
import OrderFilterChips from '@/components/customer/order-filter-chips';
import OrderHistoryCard from '@/components/customer/order-history-card';
import Pagination from '@/components/pagination';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';

const filterOptions = [
    { key: 'all', label: 'Semua' },
    { key: 'completed', label: 'Selesai' },
    { key: 'cancelled', label: 'Dibatalkan' },
];

export default function OrdersIndex({ activeOrders, historyOrders }: any) {
    const [filter, setFilter] = useState('all');

    const filteredHistory = useMemo(() => {
        if (filter === 'all') return historyOrders.data;
        if (filter === 'completed') return historyOrders.data.filter((o: any) => o.status === 'completed');
        if (filter === 'cancelled') return historyOrders.data.filter((o: any) => ['cancelled', 'failed'].includes(o.status));
        return historyOrders.data;
    }, [historyOrders.data, filter]);

    const hasActiveOrders = activeOrders && activeOrders.length > 0;
    const hasHistory = filteredHistory.length > 0;

    return (
        <CustomerMobileLayout hideTopBar>
            <Head title="Pesanan Saya" />

            {/* Sticky Page Header */}
            <header className="fixed inset-x-0 top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link href="/customer/home" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-sm font-semibold text-slate-900">Pesanan Saya</h1>
                    <div className="h-10 w-10" />
                </div>
                {/* Filter Chips — only for history filtering */}
                <div className="mx-auto max-w-lg px-4 pb-3">
                    <OrderFilterChips options={filterOptions} active={filter} onChange={setFilter} />
                </div>
            </header>

            {/* Spacer for fixed header */}
            <div className="h-26" />

            {/* Active Orders Section */}
            {hasActiveOrders && (
                <section>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pesanan Aktif</div>
                    <div className="mt-2 space-y-3">
                        {activeOrders.map((order: any) => (
                            <ActiveOrderCard key={order.id} order={order} />
                        ))}
                    </div>
                </section>
            )}

            {/* History Section */}
            <section className={hasActiveOrders ? 'mt-6' : ''}>
                {(hasHistory || !hasActiveOrders) && (
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Riwayat Pesanan</div>
                )}

                {!hasHistory && !hasActiveOrders ? (
                    <div className="mt-2">
                        <EmptyOrderState type="no-orders" />
                    </div>
                ) : !hasHistory ? (
                    <div className="mt-2">
                        <EmptyOrderState type={filter === 'all' ? 'no-orders' : 'no-results'} />
                    </div>
                ) : (
                    <div className="mt-2 space-y-3">
                        {filteredHistory.map((order: any) => (
                            <OrderHistoryCard key={order.id} order={order} />
                        ))}
                    </div>
                )}
            </section>

            <Pagination links={historyOrders.links} />
        </CustomerMobileLayout>
    );
}
