import { router } from '@inertiajs/react';
import { useState } from 'react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { getOrderStatus } from '@/lib/status-labels';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'needs_action', label: 'Butuh Tindakan' },
    { key: 'active', label: 'Aktif' },
    { key: 'completed', label: 'Selesai' },
    { key: 'cancelled', label: 'Dibatalkan' },
    { key: 'failed', label: 'Gagal' },
];

export default function OwnerOrdersIndex({
    orders,
    outlets,
    filters,
    stats,
    couriers,
}: any) {
    const [assignOrder, setAssignOrder] = useState<any>(null);

    if (!orders || !filters) {
        return (
            <OwnerPageShell title="Pesanan" subtitle="Kelola semua pesanan dari semua outlet">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const currentStatus = filters.status ?? 'needs_action';

    const setFilter = (key: string, value: string) => {
        router.get(
            '/owner/orders',
            { ...filters, [key]: value || undefined },
            { preserveState: true, replace: true },
        );
    };

    return (
        <OwnerPageShell
            title="Pesanan"
            subtitle="Kelola semua pesanan dari semua outlet"
        >
            {/* Status Pills */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {statusFilters.map((sf) => {
                    const isActive = currentStatus === sf.key;
                    const colorMap: Record<string, string> = {
                        '': 'text-primary bg-primary/10 ring-primary/20',
                        needs_action: 'text-amber-600 bg-amber-50 ring-amber-200',
                        active: 'text-blue-600 bg-blue-50 ring-blue-200',
                        completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
                        cancelled: 'text-text-muted bg-surface-muted ring-border',
                        failed: 'text-red-600 bg-red-50 ring-red-200',
                    };

                    return (
                        <button key={sf.key} type="button" onClick={() => setFilter('status', sf.key)}
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-all ${
                                isActive ? colorMap[sf.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}>
                            {sf.label}
                        </button>
                    );
                })}
            </div>

            {/* Filter controls */}
            <OwnerFilterCard
                searchPlaceholder="Cari kode..."
                searchValue={filters.search ?? ''}
                onSearch={(val) => setFilter('search', val)}
                outletOptions={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => setFilter('outlet_id', val)}
                courierOptions={couriers?.map((c: any) => ({ value: String(c.id), label: c.name }))}
                courierValue={filters.courier_id ?? ''}
                onCourierChange={(val) => setFilter('courier_id', val)}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => setFilter('date', val)}
            />

            {/* KPI Strip */}
            <OwnerKpiStrip items={[
                { label: 'Total', value: stats?.total_today ?? 0, sublabel: (stats?.total_today ?? 0) > 0 ? 'Hari ini' : undefined, sublabelColor: 'text-blue-600' },
                { label: 'Tindakan', value: stats?.pending ?? 0, sublabel: (stats?.pending ?? 0) > 0 ? 'Perlu assign kurir' : undefined, sublabelColor: 'text-amber-600' },
                { label: 'Selesai', value: stats?.completed_today ?? 0 },
                { label: 'Revenue', value: formatCurrency(stats?.revenue_today ?? 0) },
            ]} />

            {/* Table */}
            {orders.data.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada pesanan
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    {/* Header */}
                    <div className="grid grid-cols-[90px_1fr_100px_80px_70px] items-center gap-3 bg-surface-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        <span>Kode</span><span>Customer / Outlet</span><span>Status</span><span className="text-right">Total</span><span />
                    </div>
                    {/* Rows */}
                    {orders.data.map((order: any) => {
                        const s = getOrderStatus(order.status);

                        return (
                            <div key={order.id}
                                className="grid grid-cols-[90px_1fr_100px_80px_70px] items-center gap-3 border-t border-border px-3 py-2 text-sm transition-colors last:border-t-0 hover:bg-surface-muted">
                                <span className="font-bold tabular-nums text-text">{order.order_code}</span>
                                <span className="truncate text-text-muted">{order.customer_name ?? '—'} · {order.outlet?.name ?? '—'}</span>
                                <span><StatusBadge variant={s.variant} size="sm">{s.label}</StatusBadge></span>
                                <span className="text-right font-semibold tabular-nums text-primary">{formatCurrency(order.total)}</span>
                                <div className="flex items-center gap-1 justify-end">
                                    {order.status === 'ready_for_pickup' && !order.delivery && (
                                        <button type="button" onClick={() => setAssignOrder(order)}
                                            className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-white hover:bg-primary-hover">
                                            Assign
                                        </button>
                                    )}
                                    <button type="button" onClick={() => router.visit(`/owner/orders/${order.id}`)}
                                        className="rounded-md px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary-light">
                                        Detail →
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Pagination links={orders.links} />

            <AssignCourierSheet
                order={assignOrder}
                couriers={couriers ?? []}
                open={!!assignOrder}
                onClose={() => setAssignOrder(null)}
            />
        </OwnerPageShell>
    );
}
