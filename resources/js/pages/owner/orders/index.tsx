import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import AssignCourierSheet from '@/components/owner/assign-courier-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import DataTable from '@/components/ui/data-table';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { getOrderStatus } from '@/lib/status-labels';

const statusFilters = [
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

    const setFilter = (key: string, value: string) => {
        router.get('/owner/orders', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell
            title="Pesanan"
            headerRight={
                <>
                    <input
                        defaultValue={filters.search ?? ''}
                        onBlur={(e) => setFilter('search', e.target.value)}
                        placeholder="Cari kode pesanan..."
                        className="h-9 w-48 rounded-lg border border-zinc-200 px-3 text-sm"
                    />
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => setFilter('status', e.target.value)}
                        className="h-9 rounded-lg border border-zinc-200 px-3 text-sm"
                    >
                        <option value="">Semua status</option>
                        {statusFilters.slice(1).map((sf) => <option key={sf.key} value={sf.key}>{sf.label}</option>)}
                    </select>
                    <select
                        value={filters.outlet_id ?? ''}
                        onChange={(e) => setFilter('outlet_id', e.target.value)}
                        className="h-9 rounded-lg border border-zinc-200 px-3 text-sm"
                    >
                        <option value="">Semua outlet</option>
                        {outlets.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <input
                        type="date"
                        value={filters.date ?? ''}
                        onChange={(e) => setFilter('date', e.target.value)}
                        className="h-9 rounded-lg border border-zinc-200 px-3 text-sm"
                    />
                </>
            }
        >
            <DataTable
                    rowKey="id"
                    data={orders.data}
                    columns={[
                        {
                            key: 'order_code',
                            label: 'Kode Pesanan',
                            className: 'font-bold tabular-nums text-slate-900',
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

            <AssignCourierSheet order={assignOrder} couriers={couriers ?? []} open={!!assignOrder} onClose={() => setAssignOrder(null)} />
        </OwnerPageShell>
    );
}
