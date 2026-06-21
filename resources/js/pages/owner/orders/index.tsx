import { Head, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
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
                        value={filters.status ?? ''}
                        onChange={(e) => setFilter('status', e.target.value)}
                        options={statusFilters.slice(1).map((sf) => ({ value: sf.key, label: sf.label }))}
                        placeholder="Semua status"
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
