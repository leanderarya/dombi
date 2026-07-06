import { router } from '@inertiajs/react';
import {
    ArrowDownRight,
    ClipboardList,
    Clock,
    DollarSign,
    Search,
    TrendingUp,
} from 'lucide-react';
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

    // Default to 'needs_action' when no status filter is set
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
            <div className="mb-4 space-y-3">
                <div className="scrollbar-none flex flex-wrap gap-2">
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
                            <button
                                key={sf.key}
                                type="button"
                                onClick={() => setFilter('status', sf.key)}
                                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                    isActive
                                        ? colorMap[sf.key] ?? 'bg-primary/10 text-primary ring-primary/20'
                                        : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                                }`}
                            >
                                {sf.label}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Input
                        icon={Search}
                        defaultValue={filters.search ?? ''}
                        onBlur={(e) => setFilter('search', e.target.value)}
                        placeholder="Cari kode pesanan..."
                        aria-label="Cari pesanan"
                        className="h-9 w-48"
                    />
                    <Select
                        value={filters.outlet_id ?? ''}
                        onChange={(e) => setFilter('outlet_id', e.target.value)}
                        aria-label="Filter outlet"
                        options={[
                            { value: '', label: 'Semua outlet' },
                            ...outlets.map((o: any) => ({ value: String(o.id), label: o.name })),
                        ]}
                    />
                    <Input
                        type="date"
                        value={filters.date ?? ''}
                        onChange={(e) => setFilter('date', e.target.value)}
                        aria-label="Filter tanggal"
                        className="h-9"
                    />
                </div>
            </div>

            {/* Desktop layout */}
            <div className="grid grid-cols-[1fr_320px] gap-6">
                {/* Left: order list */}
                <div>
                    {orders.data.length === 0 ? (
                        <div className="rounded-xl bg-white py-12 text-center text-sm text-text-muted">
                            Tidak ada pesanan
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {orders.data.map((order: any) => {
                                const s = getOrderStatus(order.status);

                                return (
                                    <div
                                        key={order.id}
                                        className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-md"
                                    >
                                        {/* Row 1: code + badge + total */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-text tabular-nums">
                                                    {order.order_code}
                                                </span>
                                                <StatusBadge
                                                    variant={s.variant}
                                                    size="sm"
                                                >
                                                    {s.label}
                                                </StatusBadge>
                                            </div>
                                            <span className="text-sm font-bold text-primary tabular-nums">
                                                {formatCurrency(order.total)}
                                            </span>
                                        </div>

                                        {/* Row 2: metadata + action */}
                                        <div className="mt-1.5 flex items-center justify-between">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                                                <span>{order.customer_name ?? '-'}</span>
                                                <span className="text-text-subtle">&middot;</span>
                                                <span>{order.outlet?.name ?? '-'}</span>
                                                {order.created_at && (
                                                    <>
                                                        <span className="text-text-subtle">&middot;</span>
                                                        <span>
                                                            {new Date(order.created_at).toLocaleString('id-ID', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {order.status === 'ready_for_pickup' && !order.delivery && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setAssignOrder(order)}
                                                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
                                                    >
                                                        Assign Kurir
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => router.visit(`/owner/orders/${order.id}`)}
                                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-light"
                                                >
                                                    Detail
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <Pagination links={orders.links} />
                </div>

                {/* Right: KPI stats sidebar */}
                <div className="sticky top-4 self-start space-y-3">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <ClipboardList className="h-4 w-4 text-blue-600" />
                            Total Pesanan
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">
                            {stats?.total_today ?? 0}
                        </div>
                        {(stats?.total_today ?? 0) > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-600">
                                <TrendingUp className="h-3 w-3" />
                                Hari ini
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <Clock className="h-4 w-4 text-amber-600" />
                            Butuh Tindakan
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">
                            {stats?.pending ?? 0}
                        </div>
                        {(stats?.pending ?? 0) > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                                <ArrowDownRight className="h-3 w-3" />
                                Perlu assign kurir
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                            Selesai Hari Ini
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">
                            {stats?.completed_today ?? 0}
                        </div>
                        {(stats?.completed_today ?? 0) > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                <TrendingUp className="h-3 w-3" />
                                Pesanan selesai
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <DollarSign className="h-4 w-4 text-violet-600" />
                            Pendapatan Hari Ini
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">
                            {formatCurrency(stats?.revenue_today ?? 0)}
                        </div>
                    </div>

                    {/* Quick actions */}
                    {(stats?.pending ?? 0) > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <div className="text-sm font-bold text-amber-800">
                                Perlu Tindakan
                            </div>
                            <div className="mt-1 text-xs text-amber-700">
                                {stats?.pending} pesanan menunggu assign kurir
                            </div>
                            <button
                                onClick={() =>
                                    setFilter('status', 'needs_action')
                                }
                                className="mt-3 w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                            >
                                Lihat Pesanan
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <AssignCourierSheet
                order={assignOrder}
                couriers={couriers ?? []}
                open={!!assignOrder}
                onClose={() => setAssignOrder(null)}
            />
        </OwnerPageShell>
    );
}
