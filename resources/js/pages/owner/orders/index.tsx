import { router } from '@inertiajs/react';
import { ArrowDownRight, ChevronRight, ClipboardList, Clock, DollarSign, Search, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { STATUS_BORDER } from '@/lib/status-border';
import { getOrderStatus } from '@/lib/status-labels';

const statusFilters = [
    { key: 'needs_action', label: 'Butuh Tindakan' },
    { key: '', label: 'Semua' },
    { key: 'pending_confirmation', label: 'Menunggu Konfirmasi' },
    { key: 'confirmed', label: 'Diterima' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'ready_for_pickup', label: 'Siap Diambil' },
    { key: 'delivering', label: 'Dalam Pengiriman' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected_by_outlet', label: 'Ditolak Outlet' },
    { key: 'cancelled_by_customer', label: 'Dibatalkan Customer' },
    { key: 'cancelled_by_outlet', label: 'Dibatalkan Outlet' },
    { key: 'failed_delivery', label: 'Pengiriman Gagal' },
    { key: 'expired', label: 'Kadaluarsa' },
];

export default function OwnerOrdersIndex({ orders, outlets, filters, stats, couriers }: any) {
    const [assignOrder, setAssignOrder] = useState<any>(null);

    // Default to 'needs_action' when no status filter is set
    const currentStatus = filters.status ?? 'needs_action';

    const setFilter = (key: string, value: string) => {
        router.get('/owner/orders', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    const handleQuickConfirm = (orderId: number) => {
        router.visit(`/owner/orders/${orderId}`);
    };

    return (
        <OwnerPageShell
            title="Pesanan"
            subtitle="Kelola semua pesanan dari semua outlet"
        >
            {/* Filter controls */}
            <div className="mb-4 space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {statusFilters.map((sf) => (
                        <button
                            key={sf.key}
                            type="button"
                            onClick={() => setFilter('status', sf.key)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                                currentStatus === sf.key
                                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                    : 'bg-surface-muted text-text-muted hover:bg-zinc-200'
                            }`}
                        >
                            {sf.label}
                        </button>
                    ))}
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
                    <select
                        value={filters.outlet_id ?? ''}
                        onChange={(e) => setFilter('outlet_id', e.target.value)}
                        aria-label="Filter outlet"
                        className="h-8 rounded-full border border-border bg-white px-3 text-xs font-medium text-text-muted"
                    >
                        <option value="">Semua outlet</option>
                        {outlets.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <Input
                        type="date"
                        value={filters.date ?? ''}
                        onChange={(e) => setFilter('date', e.target.value)}
                        aria-label="Filter tanggal"
                        className="h-9"
                    />
                </div>
            </div>

            {/* Mobile card layout (below lg) */}
            <div className="space-y-3 lg:hidden">
                {orders.data.length === 0 ? (
                    <div className="rounded-xl bg-white py-12 text-center text-sm text-text-muted">Tidak ada pesanan</div>
                ) : (
                    orders.data.map((order: any) => {
                        const s = getOrderStatus(order.status);
                        const borderColor = STATUS_BORDER[order.status] ?? 'border-l-gray-300';

                        return (
                            <button
                                key={order.id}
                                onClick={() => router.visit(`/owner/orders/${order.id}`)}
                                className={`w-full rounded-xl border border-border border-l-4 ${borderColor} bg-white p-5 text-left transition-all duration-200 hover:shadow-md active:bg-surface-muted`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="text-base font-bold tabular-nums text-text">{order.order_code}</div>
                                    <StatusBadge variant={s.variant} size="md">{s.label}</StatusBadge>
                                </div>
                                <div className="mt-1 text-base text-text-muted">{order.outlet?.name ?? '-'}</div>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-lg font-bold tabular-nums">{formatCurrency(order.total)}</span>
                                    <div className="flex items-center gap-2">
                                        {order.status === 'pending_confirmation' && (
                                            <span
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleQuickConfirm(order.id);
                                                }}
                                                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white active:bg-primary-hover"
                                            >
                                                Konfirmasi
                                            </span>
                                        )}
                                        <ChevronRight className="h-4 w-4 text-text-subtle" />
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
                <Pagination links={orders.links} />
            </div>

            {/* Desktop layout (lg and above) */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                {/* Left: order list */}
                <div>
                    {orders.data.length === 0 ? (
                        <div className="rounded-xl bg-white py-12 text-center text-sm text-text-muted">Tidak ada pesanan</div>
                    ) : (
                        <div className="space-y-3">
                            {orders.data.map((order: any) => {
                                const s = getOrderStatus(order.status);
                                const borderColor = STATUS_BORDER[order.status] ?? 'border-l-gray-300';

                                return (
                                    <div
                                        key={order.id}
                                        className={`rounded-xl border border-border border-l-4 ${borderColor} bg-white p-5 transition-all duration-200 hover:shadow-md`}
                                    >
                                        {/* Top row: order code + total */}
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="text-lg font-bold tabular-nums text-text">{order.order_code}</div>
                                                <div className="mt-1">
                                                    <StatusBadge variant={s.variant} size="sm">{s.label}</StatusBadge>
                                                </div>
                                            </div>
                                            <span className="text-lg font-bold tabular-nums text-primary">{formatCurrency(order.total)}</span>
                                        </div>

                                        {/* Middle row: customer + outlet + time */}
                                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                                            <span>{order.customer_name ?? '-'}</span>
                                            <span className="text-text-subtle">&middot;</span>
                                            <span>{order.outlet?.name ?? '-'}</span>
                                            {order.created_at && (
                                                <>
                                                    <span className="text-text-subtle">&middot;</span>
                                                    <span>{new Date(order.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                </>
                                            )}
                                        </div>

                                        {/* Bottom row: action buttons */}
                                        <div className="mt-4 flex gap-2">
                                            {order.status === 'pending_confirmation' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickConfirm(order.id)}
                                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                                                >
                                                    Konfirmasi
                                                </button>
                                            )}
                                            {order.status === 'ready_for_pickup' && !order.delivery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setAssignOrder(order)}
                                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                                                >
                                                    Assign Kurir
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => router.visit(`/owner/orders/${order.id}`)}
                                                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
                                            >
                                                Detail
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <Pagination links={orders.links} />
                </div>

                {/* Right: KPI stats sidebar */}
                <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <ClipboardList className="h-4 w-4 text-blue-600" />
                            Total Pesanan
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{stats?.total_today ?? 0}</div>
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
                            Menunggu Konfirmasi
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{stats?.pending ?? 0}</div>
                        {(stats?.pending ?? 0) > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                                <ArrowDownRight className="h-3 w-3" />
                                Perlu ditinjau
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                            Selesai Hari Ini
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{stats?.completed_today ?? 0}</div>
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
                        <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(stats?.revenue_today ?? 0)}</div>
                    </div>

                    {/* Quick actions */}
                    {(stats?.pending ?? 0) > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <div className="text-base font-semibold text-amber-800">Perlu Tindakan</div>
                            <div className="mt-1 text-sm text-amber-700">{stats?.pending} pesanan menunggu konfirmasi</div>
                            <button
                                onClick={() => setFilter('status', 'pending_confirmation')}
                                className="mt-3 w-full rounded-lg bg-amber-600 px-3 py-2 text-base font-semibold text-white transition-colors hover:bg-amber-700"
                            >
                                Lihat Pesanan
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <AssignCourierSheet order={assignOrder} couriers={couriers ?? []} open={!!assignOrder} onClose={() => setAssignOrder(null)} />
        </OwnerPageShell>
    );
}
