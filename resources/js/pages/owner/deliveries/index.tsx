import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import FilterSheet from '@/components/owner/filter-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import DataTable from '@/components/ui/data-table';
import StatusBadge from '@/components/ui/status-badge';
import Pagination from '@/components/pagination';
import { getDeliveryStatus } from '@/lib/status-labels';
import { formatDate } from '@/lib/format';

const statusOptions = [
    { value: 'waiting_pickup', label: 'Menunggu Pickup' },
    { value: 'picked_up', label: 'Diambil Kurir' },
    { value: 'delivering', label: 'Dalam Pengiriman' },
    { value: 'completed', label: 'Selesai' },
    { value: 'failed', label: 'Gagal' },
];

export default function OwnerDeliveriesIndex({ deliveries, couriers, filters }: any) {
    const [filterOpen, setFilterOpen] = useState(false);

    const setFilter = (key: string, value: string) => {
        router.get('/owner/deliveries', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    const handleFilterApply = (f: Record<string, string>) => {
        router.get('/owner/deliveries', { status: f.status || undefined, courier_id: f.courier_id || undefined }, { preserveState: true, replace: true });
    };

    const activeFilterCount = [filters.status, filters.courier_id].filter(Boolean).length;

    return (
        <OwnerPageShell
            title="Pengiriman"
            headerRight={
                <>
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => setFilter('status', e.target.value)}
                        className="h-9 rounded-lg border border-zinc-200 px-3 text-sm"
                    >
                        <option value="">Semua status</option>
                        {statusOptions.map((sf) => <option key={sf.value} value={sf.value}>{sf.label}</option>)}
                    </select>
                    <select
                        value={filters.courier_id ?? ''}
                        onChange={(e) => setFilter('courier_id', e.target.value)}
                        className="h-9 rounded-lg border border-zinc-200 px-3 text-sm"
                    >
                        <option value="">Semua kurir</option>
                        {couriers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </>
            }
        >
            {deliveries.data.length === 0 ? (
                <EmptyState icon="🚚" title="Tidak ada pengiriman" description="Pengiriman akan muncul setelah kurir di-assign." />
            ) : (
                <>
                    {/* Mobile: cards */}
                    <div className="space-y-2 lg:hidden">
                        {deliveries.data.map((d: any) => (
                            <Link key={d.id} href={`/owner/deliveries/${d.id}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold tabular-nums text-slate-900">{d.order.order_code}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">{d.order.outlet?.name ?? '-'} · {d.courier?.name ?? 'Belum ada kurir'}</div>
                                    <div className="mt-1 text-[10px] tabular-nums text-slate-400">{formatDate(d.assigned_at)}</div>
                                </div>
                                <StatusBadge variant={getDeliveryStatus(d.status).variant} size="sm">
                                    {getDeliveryStatus(d.status).label}
                                </StatusBadge>
                            </Link>
                        ))}
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden lg:block">
                        <DataTable
                            rowKey="id"
                            data={deliveries.data}
                            columns={[
                                {
                                    key: 'order_code',
                                    label: 'Kode Pesanan',
                                    className: 'font-bold tabular-nums text-slate-900',
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
                    </div>
                </>
            )}
            <Pagination links={deliveries.links} />

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    { key: 'status', label: 'Status', options: statusOptions, value: filters.status ?? '' },
                    { key: 'courier_id', label: 'Kurir', options: couriers.map((c: any) => ({ value: String(c.id), label: c.name })), value: filters.courier_id ? String(filters.courier_id) : '' },
                ]}
                onApply={handleFilterApply}
            />
        </OwnerPageShell>
    );
}
