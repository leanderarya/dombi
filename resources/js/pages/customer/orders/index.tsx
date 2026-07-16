import { Head } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ActiveOrderCard from '@/components/customer/active-order-card';
import EmptyOrderState from '@/components/customer/empty-order-state';
import OrderFilterChips from '@/components/customer/order-filter-chips';
import OrderHistoryCard from '@/components/customer/order-history-card';
import RecoverySheet from '@/components/customer/recovery-sheet';
import Pagination from '@/components/ui/pagination';
import { SkeletonList } from '@/components/ui/skeleton';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { PENDING_PHONE_KEY } from '@/lib/constants';
import { useOrderRecovery } from '@/lib/order-recovery';
import { usePolling } from '@/lib/use-polling';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OrderOutlet {
    id: number;
    name: string;
}

interface OrderItem {
    product_name: string;
    quantity: number;
}

interface Order {
    id: number;
    order_code: string;
    status: string;
    payment_status: string;
    fulfillment_type: 'pickup' | 'delivery';
    total: number;
    ordered_at: string | null;
    created_at: string;
    outlet_id: number;
    recovery_token: string;
    customer_address: string | null;
    outlet: OrderOutlet;
    items: OrderItem[];
}

interface PaginatedOrders {
    data: Order[];
    links: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface Props {
    activeOrders: Order[];
    historyOrders: PaginatedOrders;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const filterOptions = [
    { key: 'all', label: 'Semua' },
    { key: 'completed', label: 'Selesai' },
    { key: 'cancelled', label: 'Dibatalkan' },
];

type ViewState = 'recovered' | 'empty';

export default function OrdersIndex({ activeOrders, historyOrders }: Props) {
    const { phone, maskedPhone, saveRecovery, clearRecovery } =
        useOrderRecovery();
    const [filter, setFilter] = useState('all');
    usePolling(20000);
    const [recoverySheetOpen, setRecoverySheetOpen] = useState(false);
    const [recoveryLoading, setRecoveryLoading] = useState(false);
    const [recoveredActive, setRecoveredActive] = useState<any[] | null>(null);
    const [recoveredHistory, setRecoveredHistory] = useState<any[] | null>(
        null,
    );

    // Check for pending recovery phone on mount (after OAuth redirect)
    useEffect(() => {
        const stored = localStorage.getItem(PENDING_PHONE_KEY);

        if (stored) {
            setRecoverySheetOpen(true);
        }
    }, []);

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
            {/* Page Title */}
            <header className="sticky top-0 z-30 bg-white/95 pt-safe backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-3">
                    <h1 className="text-base font-bold text-text">
                        Riwayat Pesanan
                    </h1>
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
            <div className="pt-4">
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
            </div>{' '}
            {/* close pt-4 px-4 wrapper */}
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
