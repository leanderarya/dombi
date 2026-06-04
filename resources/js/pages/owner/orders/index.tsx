import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import EmptyState from '@/components/empty-state';
import OperationalKpiCard from '@/components/owner/operational-kpi-card';
import OwnerBottomNav from '@/components/owner/owner-bottom-nav';
import OwnerMobileHeader, { HeaderIconButton, SearchIcon, FilterIcon } from '@/components/owner/owner-mobile-header';
import OwnerOrderCard from '@/components/owner/owner-order-card';
import OfflineBanner from '@/components/offline-banner';
import Pagination from '@/components/pagination';
import OwnerLayout from '@/layouts/owner-layout';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'pending_confirmation', label: 'Menunggu Konfirmasi' },
    { key: 'confirmed', label: 'Diterima' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'delivering', label: 'Dalam Pengiriman' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected_by_outlet', label: 'Ditolak Outlet' },
    { key: 'cancelled_by_customer', label: 'Dibatalkan Customer' },
    { key: 'cancelled_by_outlet', label: 'Dibatalkan Outlet' },
    { key: 'failed_delivery', label: 'Pengiriman Gagal' },
    { key: 'expired', label: 'Kadaluarsa' },
];

export default function OwnerOrdersIndex({ orders, outlets, filters, stats, couriers }: any) {
    const setFilter = (key: string, value: string) => {
        router.get('/owner/orders', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    return (
        <>
            {/* Desktop */}
            <div className="hidden lg:block">
                <OwnerLayout>
                    <DesktopView orders={orders} outlets={outlets} filters={filters} setFilter={setFilter} />
                </OwnerLayout>
            </div>

            {/* Mobile */}
            <div className="lg:hidden">
                <MobileView orders={orders} filters={filters} setFilter={setFilter} stats={stats} couriers={couriers} />
            </div>
        </>
    );
}

function MobileView({ orders, filters, setFilter, stats, couriers }: any) {
    const pendingCount = stats?.pendingOrders ?? 0;
    const activeCount = stats?.activeDeliveries ?? 0;
    const failedCount = stats?.failedDeliveries ?? 0;
    const [assignOrder, setAssignOrder] = useState<any>(null);

    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900">
            <Head title="Orders" />
            <OfflineBanner />

            {/* Header */}
            <OwnerMobileHeader
                title="Orders"
                actions={<><HeaderIconButton label="Search"><SearchIcon /></HeaderIconButton><HeaderIconButton label="Filter"><FilterIcon /></HeaderIconButton></>}
            />

            <main className="px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
                {/* KPI Strip */}
                <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    <OperationalKpiCard label="Pending" value={pendingCount} icon={<PendingIcon />} href="/owner/orders?status=pending" />
                    <OperationalKpiCard label="Active" value={activeCount} icon={<ActiveIcon />} href="/owner/orders?status=delivering" />
                    <OperationalKpiCard label="Failed" value={failedCount} icon={<FailedIcon />} href="/owner/orders?status=failed" />
                </div>

                {/* Status Filter Chips */}
                <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                    {statusFilters.map((sf) => {
                        const isActive = (filters.status ?? '') === sf.key;
                        return (
                            <button
                                key={sf.key}
                                onClick={() => setFilter('status', sf.key)}
                                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-150 active:scale-[0.95] ${
                                    isActive ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'
                                }`}
                            >
                                {sf.label}
                            </button>
                        );
                    })}
                </div>

                {/* Order Cards */}
                {orders.data.length === 0 ? (
                    <div className="mt-4">
                        <EmptyState icon="📦" title="Tidak ada order" description="Order akan muncul setelah customer membuat pesanan." />
                    </div>
                ) : (
                    <div className="mt-3 space-y-3">
                        {orders.data.map((order: any) => (
                            <OwnerOrderCard key={order.id} order={order} onSelect={() => router.visit(`/owner/orders/${order.id}`)} onAssign={() => setAssignOrder(order)} />
                        ))}
                    </div>
                )}

                <Pagination links={orders.links} />
            </main>

            <AssignCourierSheet order={assignOrder} couriers={couriers ?? []} open={!!assignOrder} onClose={() => setAssignOrder(null)} />
            <OwnerBottomNav />
        </div>
    );
}

function DesktopView({ orders, outlets, filters, setFilter }: any) {
    return (
        <>
            <Head title="Owner Orders" />
            <h1 className="text-xl font-semibold">Orders</h1>
            <div className="mt-4 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
                <input defaultValue={filters.search ?? ''} onBlur={(e) => setFilter('search', e.target.value)} placeholder="Search order code" className="rounded-md border px-3 py-2 text-sm" />
                <select value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua status</option>
                    {statusFilters.slice(1).map((sf) => <option key={sf.key} value={sf.key}>{sf.label}</option>)}
                </select>
                <select value={filters.outlet_id ?? ''} onChange={(e) => setFilter('outlet_id', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua outlet</option>
                    {outlets.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <input type="date" value={filters.date ?? ''} onChange={(e) => setFilter('date', e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
            </div>
            <div className="mt-4 space-y-3">
                {orders.data.length === 0 ? (
                    <EmptyState icon="📦" title="Tidak ada order" description="Order akan muncul setelah customer membuat pesanan." />
                ) : (
                    orders.data.map((order: any) => <OwnerOrderCard key={order.id} order={order} onSelect={() => router.visit(`/owner/orders/${order.id}`)} />)
                )}
            </div>
            <Pagination links={orders.links} />
        </>
    );
}

function PendingIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function ActiveIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>; }
function FailedIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>; }
