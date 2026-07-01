import ActiveOrderCard from '@/components/customer/active-order-card';
import EmptyOrderState from '@/components/customer/empty-order-state';
import OrderFilterChips from '@/components/customer/order-filter-chips';
import OrderHistoryCard from '@/components/customer/order-history-card';
import RecoverySheet from '@/components/customer/recovery-sheet';
import Pagination from '@/components/pagination';
import { SkeletonList } from '@/components/ui/skeleton';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { useOrderRecovery } from '@/lib/order-recovery';
import { Head, Link } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const filterOptions = [
    { key: 'all', label: 'Semua' },
    { key: 'completed', label: 'Selesai' },
    { key: 'cancelled', label: 'Dibatalkan' },
];

type ViewState = 'recovered' | 'empty';

export default function OrdersIndex({ activeOrders, historyOrders }: any) {
    const { hasRecovery, phone, maskedPhone, saveRecovery, clearRecovery } =
        useOrderRecovery();
    const [filter, setFilter] = useState('all');
    const [recoverySheetOpen, setRecoverySheetOpen] = useState(false);
    const [recoveryLoading, setRecoveryLoading] = useState(false);
    const [recoveredActive, setRecoveredActive] = useState<any[] | null>(null);
    const [recoveredHistory, setRecoveredHistory] = useState<any[] | null>(
        null,
    );

    const hasServerOrders =
        (activeOrders && activeOrders.length > 0) ||
        (historyOrders?.data && historyOrders.data.length > 0);
    const hasRecoveredOrders = recoveredActive !== null;

    const viewState: ViewState =
        hasServerOrders || hasRecoveredOrders ? 'recovered' : 'empty';

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
            return displayHistory.filter((o: any) =>
                [
                    'cancelled_by_customer',
                    'cancelled_by_outlet',
                    'rejected_by_outlet',
                ].includes(o.status),
            );
        }

        if (filter === 'failed') {
            return displayHistory.filter((o: any) =>
                ['failed_delivery', 'expired'].includes(o.status),
            );
        }

        return displayHistory;
    }, [displayHistory, filter]);

    const hasActiveOrders = displayActive.length > 0;
    const hasHistory = filteredHistory.length > 0;

    return (
        <CustomerMobileLayout hideTopBar>
            <Head title="Pesanan Saya" />

            {/* Sticky Page Header */}
            <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)]">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link
                        href="/customer/home"
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </Link>
                    <h1 className="text-sm font-semibold text-text">
                        Pesanan Saya
                    </h1>
                    <div className="h-10 w-10" />
                </div>
                {viewState === 'recovered' &&
                    (hasActiveOrders || hasHistory) && (
                        <div className="mx-auto max-w-lg px-4 pb-3">
                            <OrderFilterChips
                                options={filterOptions}
                                active={filter}
                                onChange={setFilter}
                            />
                        </div>
                    )}
            </header>

            <div
                className={
                    viewState === 'recovered' && (hasActiveOrders || hasHistory)
                        ? 'h-26'
                        : 'h-16'
                }
            />

            {/* STATE: Recovered — show orders with info card */}
            {viewState === 'recovered' && !recoveryLoading && (
                <>
                    {/* Recovery info card */}
                    {recoveredActive !== null && maskedPhone && (
                        <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-emerald-50 px-3 py-2">
                            <div className="text-xs text-text">
                                Pesanan ditemukan menggunakan nomor:{' '}
                                <span className="font-semibold">
                                    {maskedPhone}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    clearRecovery();
                                    setRecoveredActive(null);
                                    setRecoveredHistory(null);
                                    setRecoverySheetOpen(true);
                                }}
                                className="min-h-[44px] shrink-0 px-2 text-[13px] text-text-subtle active:opacity-80"
                            >
                                Ganti
                            </button>
                        </div>
                    )}

                    {/* Active Orders */}
                    {hasActiveOrders && (
                        <section>
                            <div className="text-[13px] text-text-subtle">
                                Pesanan Aktif
                            </div>
                            <div className="mt-2 space-y-3">
                                {displayActive.map((order: any) => (
                                    <ActiveOrderCard
                                        key={order.id}
                                        order={order}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* History */}
                    <section className={hasActiveOrders ? 'mt-6' : ''}>
                        <div className="text-[13px] text-text-subtle">
                            {recoveredActive !== null
                                ? 'Riwayat Pesanan Terbaru'
                                : 'Riwayat Pesanan'}
                        </div>

                        {!hasHistory ? (
                            <div className="mt-2">
                                <EmptyOrderState
                                    type={
                                        filter === 'all'
                                            ? 'no-orders'
                                            : 'no-results'
                                    }
                                />
                            </div>
                        ) : (
                            <div className="mt-2 space-y-3">
                                {filteredHistory.map((order: any) => (
                                    <OrderHistoryCard
                                        key={order.id}
                                        order={order}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* STATE: Loading recovery */}
            {recoveryLoading && (
                <div className="px-4">
                    <SkeletonList count={3} />
                </div>
            )}

            {/* STATE: Empty — no data, no recovery candidate */}
            {viewState === 'empty' && (
                <div className="mt-8 flex flex-col items-center px-4 text-center">
                    <EmptyOrderState type="no-orders" />

                    <div className="mt-8 w-full max-w-sm rounded-xl border border-border bg-white p-5 shadow-sm">
                        <p className="text-sm font-semibold text-text">
                            Pernah pesan sebelumnya?
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                            Cari pesananmu menggunakan nomor WhatsApp yang
                            dipakai saat memesan.
                        </p>
                        <button
                            type="button"
                            onClick={() => setRecoverySheetOpen(true)}
                            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white active:opacity-80"
                        >
                            <Search className="h-4 w-4" />
                            Cari Pesanan Saya
                        </button>
                    </div>
                </div>
            )}

            {/* Pagination — only for server-side results */}
            {viewState === 'recovered' &&
                recoveredActive === null &&
                historyOrders?.links && (
                    <Pagination links={historyOrders.links} />
                )}

            {/* Recovery Sheet */}
            <RecoverySheet
                open={recoverySheetOpen}
                onClose={() => setRecoverySheetOpen(false)}
                onLoadingChange={setRecoveryLoading}
                onRecovered={(result) => {
                    setRecoveredActive(result.active_orders);
                    setRecoveredHistory(result.recent_orders);
                }}
            />
        </CustomerMobileLayout>
    );
}
