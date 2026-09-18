import { Head, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import ActiveOrderCard from '@/components/customer/active-order-card';
import EmptyOrderState from '@/components/customer/empty-order-state';
import OrderHistoryCard from '@/components/customer/order-history-card';
import RecoverySheet from '@/components/customer/recovery-sheet';
import { Button } from '@/components/ui/button';
import FilterChips from '@/components/ui/filter-chips';
import Pagination from '@/components/ui/pagination';
import { SkeletonList } from '@/components/ui/skeleton';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import type { RefundBadge } from '@/lib/active-order-card-state';
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
    refund_badge?: RefundBadge | null;
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
    { key: 'failed', label: 'Gagal' },
];

type ViewState = 'recovered' | 'empty';

/**
 * Section heading band from the kanvas: 12/700 on `$text-muted`, raised off
 * the page plane so it reads as a divider rather than a floating caption.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-canvas px-5 pt-[18px] pb-2 text-xs font-bold text-text-muted">
            {children}
        </div>
    );
}

export default function OrdersIndex({ activeOrders, historyOrders }: Props) {
    const { maskedPhone, clearRecovery } = useOrderRecovery();
    const [filter, setFilter] = useState(
        () =>
            new URLSearchParams(window.location.search).get('filter') ?? 'all',
    );
    usePolling(20000);
    const [recoverySheetOpen, setRecoverySheetOpen] = useState(false);
    const [recoveryLoading, setRecoveryLoading] = useState(false);
    const [recoveredActive, setRecoveredActive] = useState<any[] | null>(null);
    const [recoveredHistory, setRecoveredHistory] = useState<any[] | null>(
        null,
    );

    function handleFilterChange(next: string) {
        setFilter(next);
        router.get(
            '/customer/orders',
            next === 'all' ? {} : { filter: next, page: 1 },
            { preserveState: true, replace: true },
        );
    }

    // Check for pending recovery phone on mount (after OAuth redirect)
    useEffect(() => {
        const timeout = window.setTimeout(() => {
            if (localStorage.getItem(PENDING_PHONE_KEY)) {
                setRecoverySheetOpen(true);
            }
        }, 0);

        return () => window.clearTimeout(timeout);
    }, []);

    const hasServerOrders =
        (activeOrders && activeOrders.length > 0) ||
        (historyOrders?.data && historyOrders.data.length > 0);
    const hasRecoveredOrders = recoveredActive !== null;

    const viewState: ViewState =
        hasServerOrders || hasRecoveredOrders ? 'recovered' : 'empty';

    const displayActive = recoveredActive ?? activeOrders ?? [];
    const displayHistory = recoveredHistory ?? historyOrders?.data ?? [];

    const hasActiveOrders = displayActive.length > 0;
    // Server already filters history; count what's shown.
    const hasHistory = displayHistory.length > 0;

    return (
        <CustomerMobileLayout hideTopBar pageClassName="bg-canvas">
            <Head title="Pesanan Saya" />
            {/* Page header — the kanvas component `Page Header/Customer`
                (`hasMu`): surface fill, padding 12/20/16/20, one centred
                16/700 title in the body font and no subtitle. The filter row
                stays visible in every state (Orders 1–4), empty ones included. */}
            <header className="sticky top-0 z-30 bg-surface/95 pt-safe-header backdrop-blur">
                <div className="mx-auto max-w-lg px-5 pb-4">
                    <h1 className="text-center text-base font-bold text-text">
                        Riwayat Pesanan
                    </h1>
                </div>
                <div className="mx-auto max-w-lg px-5 pb-3">
                    <FilterChips
                        options={filterOptions}
                        active={filter}
                        onChange={handleFilterChange}
                        variant="neutral"
                        size="caption"
                    />
                </div>
            </header>
            <div className="mx-auto max-w-lg">
                {/* STATE: Recovered — show orders with info card */}
                {viewState === 'recovered' && !recoveryLoading && (
                    <>
                        {/* Recovery info card — app-only, not in the kanvas */}
                        {recoveredActive !== null && maskedPhone && (
                            <div className="mx-5 mb-3 flex items-center justify-between rounded-card border border-border bg-surface px-3 py-2">
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
                                    className="min-h-[44px] shrink-0 px-2 text-control text-text-subtle active:opacity-80"
                                >
                                    Ganti
                                </button>
                            </div>
                        )}

                        {/* Active Orders */}
                        {hasActiveOrders && (
                            <section>
                                <SectionLabel>Pesanan Aktif</SectionLabel>
                                <div className="space-y-3 px-5 pb-3">
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
                        <section>
                            <SectionLabel>
                                {recoveredActive !== null
                                    ? 'Riwayat Pesanan Terbaru'
                                    : 'Riwayat Pesanan'}
                            </SectionLabel>

                            {!hasHistory ? (
                                <div className="px-5 pb-3">
                                    <EmptyOrderState
                                        type={
                                            filter === 'all'
                                                ? 'no-orders'
                                                : 'no-results'
                                        }
                                    />
                                </div>
                            ) : (
                                <div className="space-y-3 px-5 pb-3">
                                    {displayHistory.map((order: any) => (
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
                    <div className="px-5">
                        <SkeletonList count={3} />
                    </div>
                )}

                {/* STATE: Empty — no data, no recovery candidate. The kanvas
                    `Orders 3 — Kosong` still draws the history band above the
                    empty card, so the band is not tied to having rows. */}
                {viewState === 'empty' && (
                    <section>
                        <SectionLabel>Riwayat Pesanan</SectionLabel>
                        <div className="px-5 pb-3">
                            <EmptyOrderState type="no-orders" />

                            {/* Recovery is an app-only escape hatch — the kanvas
                                draws no equivalent block, so it sits below the
                                drawn empty state as a quiet card. */}
                            <div className="mt-4 rounded-card border border-border bg-surface p-5">
                                <p className="text-sm font-semibold text-text">
                                    Pernah pesan sebelumnya?
                                </p>
                                <p className="mt-1 text-xs text-text-muted">
                                    Cari pesananmu menggunakan nomor WhatsApp
                                    yang dipakai saat memesan.
                                </p>
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="md"
                                    className="mt-4 w-full"
                                    onClick={() => setRecoverySheetOpen(true)}
                                >
                                    <Search className="h-4 w-4" />
                                    Cari Pesanan Saya
                                </Button>
                            </div>
                        </div>
                    </section>
                )}
            </div>
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
