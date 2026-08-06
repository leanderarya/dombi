import { router } from '@inertiajs/react';
import {
    CheckCircle,
    Clock,
    DollarSign,
    Package,
    ShoppingCart,
} from 'lucide-react';
import { useState } from 'react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerTable from '@/components/owner/owner-table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '@/components/ui/table';
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
            <OwnerPageShell
                title="Pesanan"
                subtitle="Pantau seluruh pesanan pelanggan"
            >
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
            subtitle="Pantau seluruh pesanan pelanggan"
        >
            {/* KPI Strip */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Pesanan Hari Ini
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                            <ShoppingCart className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">
                        {stats?.total_today ?? 0}
                    </div>
                    <p className="text-[11px] text-text-muted">Total hari ini</p>
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Pendapatan
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                            <DollarSign className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">
                        {formatCurrency(stats?.revenue_today ?? 0)}
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Pendapatan hari ini
                    </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Butuh Tindakan
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                            <Clock className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">
                        {stats?.pending ?? 0}
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Perlu tugaskan kurir
                    </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Selesai
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
                            <CheckCircle className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">
                        {stats?.completed_today ?? 0}
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Selesai hari ini
                    </p>
                </div>
            </div>

            {/* Status Filter Chips */}
            <div
                aria-label="Filter status pesanan"
                className="mb-4 flex flex-wrap items-center gap-2"
            >
                {statusFilters.map((sf) => {
                    const isActive = currentStatus === sf.key;

                    return (
                        <button
                            key={sf.key}
                            type="button"
                            onClick={() => setFilter('status', sf.key)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                isActive
                                    ? 'bg-primary/10 text-primary ring-primary/20'
                                    : 'bg-surface text-text-muted ring-border hover:bg-mint-wash'
                            }`}
                        >
                            {sf.label}
                        </button>
                    );
                })}
            </div>

            {/* Filter controls */}
            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari kode atau pelanggan..."
                searchValue={filters.search ?? ''}
                onSearch={(val) => setFilter('search', val)}
                outletOptions={outlets.map((o: any) => ({
                    value: String(o.id),
                    label: o.name,
                }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => setFilter('outlet_id', val)}
                courierOptions={couriers?.map((c: any) => ({
                    value: String(c.id),
                    label: c.name,
                }))}
                courierValue={filters.courier_id ?? ''}
                onCourierChange={(val) => setFilter('courier_id', val)}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => setFilter('date', val)}
            />

            {/* Table */}
            {orders.data.length === 0 ? (
                <EmptyState
                    icon={<Package aria-hidden="true" className="h-8 w-8" />}
                    title="Tidak ada pesanan"
                    description="Pesanan akan muncul di sini setelah pelanggan melakukan pemesanan"
                />
            ) : (
                <OwnerTable>
                    <Table>
                        <TableHeader>
                            <tr className="bg-surface-muted/50">
                                <TableHead className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
                                    Kode
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
                                    Pelanggan
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
                                    Outlet
                                </TableHead>
                                <TableHead className="px-4 py-3 text-left text-xs font-semibold text-text-muted">
                                    Status
                                </TableHead>
                                <TableHead className="px-4 py-3 text-right text-xs font-semibold text-text-muted">
                                    Total
                                </TableHead>
                                <TableHead className="px-4 py-3 text-right text-xs font-semibold text-text-muted">
                                    Aksi
                                </TableHead>
                            </tr>
                        </TableHeader>
                        <TableBody>
                            {orders.data.map((order: any) => {
                                const s = getOrderStatus(order.status);

                                return (
                                    <TableRow
                                        key={order.id}
                                        className="border-t border-border/20 transition-colors hover:bg-emerald-50/40"
                                    >
                                        <TableCell className="px-4 py-3 font-mono font-bold text-primary tabular-nums">
                                            {order.order_code}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="font-medium text-text">
                                                {order.customer_name ?? '—'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-text-muted">
                                            {order.outlet?.name ?? '—'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <StatusBadge
                                                variant={s.variant}
                                                size="sm"
                                            >
                                                {s.label}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right font-semibold tabular-nums text-text">
                                            {formatCurrency(order.total)}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                {order.status ===
                                                    'ready_for_pickup' &&
                                                    !order.delivery && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() =>
                                                                setAssignOrder(
                                                                    order,
                                                                )
                                                            }
                                                        >
                                                            Tugaskan
                                                        </Button>
                                                    )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.visit(
                                                            `/owner/orders/${order.id}`,
                                                        )
                                                    }
                                                >
                                                    Detail
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </OwnerTable>
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
