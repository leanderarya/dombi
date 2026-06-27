import { router } from '@inertiajs/react';
import { ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import DataTable from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
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
                    <Select
                        value={currentStatus}
                        onChange={(e) => setFilter('status', e.target.value)}
                        options={[
                            { value: 'needs_action', label: 'Butuh Tindakan' },
                            { value: '', label: 'Semua' },
                            ...statusFilters.filter((sf) => sf.key !== '' && sf.key !== 'needs_action').map((sf) => ({ value: sf.key, label: sf.label })),
                        ]}
                        aria-label="Filter status"
                        className="h-9"
                    />
                    <Select
                        value={filters.outlet_id ?? ''}
                        onChange={(e) => setFilter('outlet_id', e.target.value)}
                        options={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
                        placeholder="Semua outlet"
                        aria-label="Filter outlet"
                        className="h-9"
                    />
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

                        return (
                            <button
                                key={order.id}
                                onClick={() => router.visit(`/owner/orders/${order.id}`)}
                                className="w-full rounded-xl border border-border bg-surface p-4 text-left active:bg-surface-muted"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="font-bold tabular-nums text-text">{order.order_code}</div>
                                    <StatusBadge variant={s.variant} size="sm">{s.label}</StatusBadge>
                                </div>
                                <div className="mt-1 text-sm text-text-muted">{order.outlet?.name ?? '-'}</div>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-lg font-bold tabular-nums">{formatCurrency(order.total)}</span>
                                    <div className="flex items-center gap-2">
                                        {order.status === 'pending_confirmation' && (
                                            <span
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleQuickConfirm(order.id);
                                                }}
                                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white active:bg-primary-hover"
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

            {/* Desktop table layout (lg and above) */}
            <div className="hidden lg:block">
                <DataTable
                    rowKey="id"
                    data={orders.data}
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

            <AssignCourierSheet order={assignOrder} couriers={couriers ?? []} open={!!assignOrder} onClose={() => setAssignOrder(null)} />
        </OwnerPageShell>
    );
}
