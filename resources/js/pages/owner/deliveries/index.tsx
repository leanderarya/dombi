import { Link, router } from '@inertiajs/react';
import { LayoutGrid, Truck } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/ui/data-table';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';
import { getDeliveryStatus } from '@/lib/status-labels';

const statusOptions = [
    { value: 'waiting_pickup', label: 'Menunggu Pickup' },
    { value: 'picked_up', label: 'Diambil Kurir' },
    { value: 'delivering', label: 'Dalam Pengiriman' },
    { value: 'completed', label: 'Selesai' },
    { value: 'failed', label: 'Gagal' },
];

export default function OwnerDeliveriesIndex({ deliveries, couriers, filters }: any) {
    const setFilter = (key: string, value: string) => {
        router.get('/owner/deliveries', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell
            title="Pengiriman"
            headerRight={
                <>
                    <Link href="/owner/deliveries/board">
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <LayoutGrid className="h-4 w-4" />
                            Board View
                        </Button>
                    </Link>
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => setFilter('status', e.target.value)}
                        className="h-9 rounded-lg border border-border px-3 text-sm"
                    >
                        <option value="">Semua status</option>
                        {statusOptions.map((sf) => <option key={sf.value} value={sf.value}>{sf.label}</option>)}
                    </select>
                    <select
                        value={filters.courier_id ?? ''}
                        onChange={(e) => setFilter('courier_id', e.target.value)}
                        className="h-9 rounded-lg border border-border px-3 text-sm"
                    >
                        <option value="">Semua kurir</option>
                        {couriers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </>
            }
        >
            {deliveries.data.length === 0 ? (
                <EmptyState icon={<Truck className="h-8 w-8 text-text-subtle" />} title="Tidak ada pengiriman" description="Pengiriman akan muncul setelah kurir di-assign." />
            ) : (
                <DataTable
                    rowKey="id"
                    data={deliveries.data}
                    columns={[
                        {
                            key: 'order_code',
                            label: 'Kode Pesanan',
                            className: 'font-bold tabular-nums text-text',
                            render: (row: any) => row.order?.order_code ?? '-',
                        },
                        {
                            key: 'outlet',
                            label: 'Outlet',
                            render: (row: any) => row.order?.outlet?.name ?? '-',
                        },
                        {
                            key: 'courier',
                            label: 'Kurir',
                            render: (row: any) => row.courier?.name ?? 'Belum ada kurir',
                        },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (row: any) => {
                                const s = getDeliveryStatus(row.status);

                                return <StatusBadge variant={s.variant} size="sm">{s.label}</StatusBadge>;
                            },
                        },
                        {
                            key: 'assigned_at',
                            label: 'Waktu',
                            render: (row: any) => formatDate(row.assigned_at),
                        },
                    ]}
                    actions={[
                        {
                            label: 'Detail',
                            variant: 'secondary',
                            onClick: (row) => router.visit(`/owner/deliveries/${row.id}`),
                        },
                    ]}
                    emptyMessage="Tidak ada pengiriman"
                />
            )}
            <Pagination links={deliveries.links} />
        </OwnerPageShell>
    );
}
