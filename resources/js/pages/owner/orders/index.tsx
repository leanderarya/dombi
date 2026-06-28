import { router } from '@inertiajs/react';
import { ChevronRight, ClipboardList, Clock, DollarSign, Search, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import DataTable from '@/components/ui/data-table';
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
            headerRight={
                <>
                    <Input
                        icon={Search}
                        defaultValue={filters.search ?? ''}
                        onBlur={(e) => setFilter('search', e.target.value)}
                        placeholder="Cari kode pesanan..."
                        aria-label="Cari pesanan"
                        className="h-9 w-48"
                    />
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
                </>
            }
        >
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
                    <DataTable
                        rowKey="id"
                        data={orders.data}
                        rowClassName={(row: any) => `border-l-4 ${STATUS_BORDER[row.status] ?? 'border-l-gray-300'}`}
                        columns={[
                            {
                                key: 'order_code',
                                label: 'Kode Pesanan',
                                className: 'font-bold tabular-nums text-text',
                            },
                            {
                                key: 'customer_name',
                                label: 'Pelanggan',
                            },
                            {
                                key: 'outlet',
                                label: 'Outlet',
                                render: (row: any) => row.outlet?.name ?? '-',
                            },
                            {
                                key: 'status',
                                label: 'Status',
                                render: (row: any) => {
                                    const s = getOrderStatus(row.status);

                                    return <StatusBadge variant={s.variant} size="sm">{s.label}</StatusBadge>;
                                },
                            },
                            {
                                key: 'total',
                                label: 'Total',
                                className: 'text-right tabular-nums font-semibold',
                                render: (row: any) => formatCurrency(row.total),
                            },
                            {
                                key: 'created_at',
                                label: 'Waktu',
                                render: (row: any) => row.created_at ? new Date(row.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-',
                            },
                        ]}
                        actions={[
                            {
                                label: 'Konfirmasi',
                                variant: 'primary',
                                onClick: (row) => handleQuickConfirm(row.id),
                                show: (row) => row.status === 'pending_confirmation',
                            },
                            {
                                label: 'Detail',
                                variant: 'secondary',
                                onClick: (row) => router.visit(`/owner/orders/${row.id}`),
                            },
                            {
                                label: 'Assign Kurir',
                                variant: 'primary',
                                onClick: (row) => setAssignOrder(row),
                                show: (row) => row.status === 'ready_for_pickup' && !row.delivery,
                            },
                        ]}
                        emptyMessage="Tidak ada pesanan"
                        emptyAction={{ label: 'Lihat Semua Pesanan', href: '/owner/orders' }}
                    />
                    <Pagination links={orders.links} />
                </div>

                {/* Right: KPI stats sidebar */}
                <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                    <div className="rounded-xl border border-border bg-white p-5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Ringkasan Hari Ini</h3>
                        <div className="mt-4 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                    <ClipboardList className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="text-3xl font-bold tabular-nums text-text">{stats?.total_today ?? 0}</div>
                                    <div className="text-sm text-text-muted">Total Pesanan</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="text-3xl font-bold tabular-nums text-text">{stats?.pending ?? 0}</div>
                                    <div className="text-sm text-text-muted">Menunggu Konfirmasi</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="text-3xl font-bold tabular-nums text-text">{stats?.completed_today ?? 0}</div>
                                    <div className="text-sm text-text-muted">Selesai Hari Ini</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="text-3xl font-bold tabular-nums text-text">{formatCurrency(stats?.revenue_today ?? 0)}</div>
                                    <div className="text-sm text-text-muted">Pendapatan Hari Ini</div>
                                </div>
                            </div>
                        </div>
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
