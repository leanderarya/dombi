import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Package } from 'lucide-react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
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
            {/* KPI Strip - Moved to top */}
            <OwnerKpiStrip items={[
                { label: 'Total', value: stats?.total_today ?? 0, sublabel: (stats?.total_today ?? 0) > 0 ? 'Hari ini' : undefined, sublabelColor: 'text-blue-600' },
                { label: 'Tindakan', value: stats?.pending ?? 0, sublabel: (stats?.pending ?? 0) > 0 ? 'Perlu assign kurir' : undefined, sublabelColor: 'text-amber-600' },
                { label: 'Selesai', value: stats?.completed_today ?? 0 },
                { label: 'Revenue', value: formatCurrency(stats?.revenue_today ?? 0) },
            ]} />

            {/* Status Pills */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {statusFilters.map((sf) => {
                    const isActive = currentStatus === sf.key;
                    const colorMap: Record<string, string> = {
                        '': 'text-text bg-surface-muted ring-border',
                        needs_action: 'text-amber-600 bg-amber-50 ring-amber-200',
                        active: 'text-blue-600 bg-blue-50 ring-blue-200',
                        completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
                        cancelled: 'text-text-muted bg-surface-muted ring-border',
                        failed: 'text-red-600 bg-red-50 ring-red-200',
                    };

                    return (
                        <button key={sf.key} type="button" onClick={() => setFilter('status', sf.key)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                isActive ? colorMap[sf.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}>
                            {sf.label}
                        </button>
                    );
                })}
            </div>

            {/* Filter controls - Collapsible */}
            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
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

            {/* Table - Responsive with horizontal scroll */}
            {orders.data.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8" />}
                    title="Tidak ada pesanan"
                    description="Pesanan akan muncul di sini setelah pelanggan melakukan pemesanan"
                />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[600px]">
                        <thead>
                            <tr className="bg-surface-muted">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Kode</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Customer</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Outlet</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Total</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.data.map((order: any) => {
                                const s = getOrderStatus(order.status);

                                return (
                                    <tr key={order.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                                        <td className="px-4 py-3 font-bold tabular-nums text-text">{order.order_code}</td>
                                        <td className="px-4 py-3 text-text-muted">{order.customer_name ?? '—'}</td>
                                        <td className="px-4 py-3 text-text-muted">{order.outlet?.name ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge variant={s.variant} size="sm">{s.label}</StatusBadge>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">{formatCurrency(order.total)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                {order.status === 'ready_for_pickup' && !order.delivery && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => setAssignOrder(order)}
                                                    >
                                                        Assign
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.visit(`/owner/orders/${order.id}`)}
                                                >
                                                    Detail
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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
