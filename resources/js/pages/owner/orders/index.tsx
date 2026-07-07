import { router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState } from 'react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Input } from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { getOrderStatus } from '@/lib/status-labels';

const statusFilters = [
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
            {/* Filter controls */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {statusFilters.map((sf) => {
                    const isActive = currentStatus === sf.key;
                    const colorMap: Record<string, string> = {
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
                <span className="flex-1" />
                <Input icon={Search} defaultValue={filters.search ?? ''} onBlur={(e) => setFilter('search', e.target.value)}
                    placeholder="Cari kode..." aria-label="Cari pesanan" className="h-8 w-40" />
                <Select value={filters.outlet_id ?? ''} onChange={(e) => setFilter('outlet_id', e.target.value)}
                    aria-label="Filter outlet"
                    options={[{ value: '', label: 'Semua outlet' }, ...outlets.map((o: any) => ({ value: String(o.id), label: o.name }))]} />
                <Input type="date" value={filters.date ?? ''} onChange={(e) => setFilter('date', e.target.value)}
                    aria-label="Filter tanggal" className="h-8" />
            </div>

            {/* KPI Strip */}
            <div className="mb-4 grid grid-cols-4 gap-2">
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-xs font-medium uppercase tracking-wide text-text-muted">Total</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats?.total_today ?? 0}</div>
                    {(stats?.total_today ?? 0) > 0 && <div className="text-xs font-medium text-blue-600">Hari ini</div>}
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-xs font-medium uppercase tracking-wide text-text-muted">Tindakan</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats?.pending ?? 0}</div>
                    {(stats?.pending ?? 0) > 0 && <div className="text-xs font-medium text-amber-600">Perlu assign kurir</div>}
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-xs font-medium uppercase tracking-wide text-text-muted">Selesai</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats?.completed_today ?? 0}</div>
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-xs font-medium uppercase tracking-wide text-text-muted">Revenue</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{formatCurrency(stats?.revenue_today ?? 0)}</div>
                </div>
            </div>

            {/* Table */}
            {orders.data.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada pesanan
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    {/* Header */}
                    <div className="grid grid-cols-[90px_1fr_100px_80px_70px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        <span>Kode</span><span>Customer / Outlet</span><span>Status</span><span className="text-right">Total</span><span />
                    </div>
                    {/* Rows */}
                    {orders.data.map((order: any) => {
                        const s = getOrderStatus(order.status);

                        return (
                            <div key={order.id}
                                className="grid grid-cols-[90px_1fr_100px_80px_70px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-sm transition-colors last:border-t-0 hover:bg-surface-muted">
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
