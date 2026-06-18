import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import ActiveOrderCard from '@/components/customer/active-order-card';
import EmptyOrderState from '@/components/customer/empty-order-state';
import OrderFilterChips from '@/components/customer/order-filter-chips';
import OrderHistoryCard from '@/components/customer/order-history-card';
import RecoverySheet from '@/components/customer/recovery-sheet';
import Pagination from '@/components/pagination';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { maskPhone, recoverOrders, useOrderRecovery } from '@/lib/order-recovery';

const filterOptions = [
    { key: 'all', label: 'Semua' },
    { key: 'completed', label: 'Selesai' },
    { key: 'cancelled', label: 'Dibatalkan' },
    { key: 'failed', label: 'Gagal' },
];

type ViewState = 'recovered' | 'empty';

export default function OrdersIndex({ activeOrders, historyOrders }: any) {
    const { hasRecovery, phone, maskedPhone, saveRecovery, clearRecovery } = useOrderRecovery();
    const [filter, setFilter] = useState('all');
    const [recoverySheetOpen, setRecoverySheetOpen] = useState(false);
    const [recoveredActive, setRecoveredActive] = useState<any[] | null>(null);
    const [recoveredHistory, setRecoveredHistory] = useState<any[] | null>(null);

    const hasServerOrders = (activeOrders && activeOrders.length > 0) || (historyOrders?.data && historyOrders.data.length > 0);
    const hasRecoveredOrders = recoveredActive !== null;

    const viewState: ViewState = hasServerOrders || hasRecoveredOrders
        ? 'recovered'
        : 'empty';

    const displayActive = recoveredActive ?? activeOrders ?? [];
    const displayHistory = recoveredHistory ?? historyOrders?.data ?? [];

    const filteredHistory = useMemo(() => {
        if (filter === 'all') {
return displayHistory;
}

        if (filter === 'completed') {
return displayHistory.filter((o: any) => o.status === 'completed');
}

        if (filter === 'cancelled') {
return displayHistory.filter((o: any) => ['cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet'].includes(o.status));
}

        if (filter === 'failed') {
return displayHistory.filter((o: any) => ['failed_delivery', 'expired'].includes(o.status));
}

        return displayHistory;
    }, [displayHistory, filter]);

    const hasActiveOrders = displayActive.length > 0;
    const hasHistory = filteredHistory.length > 0;

    return (
        <CustomerMobileLayout hideTopBar>
            <Head title="Pesanan Saya" />

            {/* Sticky Page Header */}
            <header className="fixed inset-x-0 top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link href="/customer/home" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-sm font-semibold text-slate-900">Pesanan Saya</h1>
                    <div className="h-10 w-10" />
                </div>
                {viewState === 'recovered' && (hasActiveOrders || hasHistory) && (
                    <div className="mx-auto max-w-lg px-4 pb-3">
                        <OrderFilterChips options={filterOptions} active={filter} onChange={setFilter} />
                    </div>
                )}
            </header>

            <div className={viewState === 'recovered' && (hasActiveOrders || hasHistory) ? 'h-26' : 'h-16'} />

            {/* STATE: Recovered — show orders with info card */}
            {viewState === 'recovered' && !recoveryLoading && (
                <>
                    {/* Recovery info card */}
                    {recoveredActive !== null && maskedPhone && (
                        <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                            <div className="text-xs text-emerald-800">
                                Pesanan ditemukan menggunakan nomor: <span className="font-semibold">{maskedPhone}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    clearRecovery();
                                    setRecoveredActive(null);
                                    setRecoveredHistory(null);
                                    setRecoverySheetOpen(true);
                                }}
                                className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-emerald-700 active:text-emerald-900"
                            >
                                Ganti
                            </button>
                        </div>
                    )}

                    {/* Active Orders */}
                    {hasActiveOrders && (
                        <section>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pesanan Aktif</div>
                            <div className="mt-2 space-y-3">
                                {displayActive.map((order: any) => (
                                    <ActiveOrderCard key={order.id} order={order} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* History */}
                    <section className={hasActiveOrders ? 'mt-6' : ''}>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {recoveredActive !== null ? 'Riwayat Pesanan Terbaru' : 'Riwayat Pesanan'}
                        </div>

                        {!hasHistory ? (
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
                </>
            )}

            {/* STATE: Empty — no data, no recovery candidate */}
            {viewState === 'empty' && (
                <div className="mt-8 flex flex-col items-center px-4 text-center">
                    <EmptyOrderState type="no-orders" />

                    <div className="mt-8 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-semibold text-slate-900">Tidak menemukan pesanan?</p>
                        <p className="mt-1 text-xs text-slate-500">Masukkan nomor WhatsApp yang digunakan saat memesan.</p>
                        <button
                            type="button"
                            onClick={() => setRecoverySheetOpen(true)}
                            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white active:bg-slate-800"
                        >
                            <Search className="h-4 w-4" />
                            Cari Pesanan Saya
                        </button>
                    </div>
                </div>
            )}

            {/* Pagination — only for server-side results */}
            {viewState === 'recovered' && recoveredActive === null && historyOrders?.links && (
                <Pagination links={historyOrders.links} />
            )}

            {/* Recovery Sheet */}
            <RecoverySheet
                open={recoverySheetOpen}
                onClose={() => setRecoverySheetOpen(false)}
                onRecovered={(result) => {
                    setRecoveredActive(result.active_orders);
                    setRecoveredHistory(result.recent_orders);
                }}
            />
        </CustomerMobileLayout>
    );
}
