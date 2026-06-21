import { Link, router, usePage } from '@inertiajs/react';
import { Store } from 'lucide-react';
import OutletProvisioningSummary from '@/components/owner/outlet-provisioning-summary';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { buttonVariants } from '@/components/ui/button';
import DataTable from '@/components/ui/data-table';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

export default function OutletsIndex({ outlets }: any) {
    const { flash } = usePage<any>().props;
    const activeOutlets = outlets.data.filter((outlet: any) => outlet.status === 'active').length;
    const lowStockOutlets = outlets.data.filter((outlet: any) => Number(outlet.low_stock_count) > 0).length;
    const busyOutlets = outlets.data.filter((outlet: any) => Number(outlet.active_orders_count) >= 3).length;

    return (
        <OwnerPageShell
            title="Outlet"
            subtitle="Manajemen cabang operasional"
            headerRight={
                <Link href="/owner/outlets/create" className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}>
                    + Tambah Outlet
                </Link>
            }
        >
            {/* Summary Cards */}
            <div className="mb-4 grid grid-cols-3 gap-2">
                <Metric label="Aktif" value={activeOutlets} />
                <Metric label="Stok Rendah" value={lowStockOutlets} warn />
                <Metric label="Sibuk" value={busyOutlets} />
            </div>

            <DataTable
                rowKey="id"
                data={outlets.data}
                columns={[
                    {
                        key: 'name',
                        label: 'Outlet',
                        className: 'font-bold text-slate-900',
                        render: (row: any) => (
                            <div>
                                <div>{row.name}</div>
                                <div className="text-[11px] text-slate-500">{row.kelurahan} · {row.kecamatan}</div>
                            </div>
                        ),
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        render: (row: any) => {
                            const status = getOutletStatus(row);

                            return <StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge>;
                        },
                    },
                    {
                        key: 'active_orders_count',
                        label: 'Pesanan Aktif',
                        className: 'tabular-nums',
                    },
                    {
                        key: 'low_stock_count',
                        label: 'Stok Rendah',
                        render: (row: any) => {
                            const count = Number(row.low_stock_count);

                            return <span className={count > 0 ? 'font-bold text-amber-600' : 'text-slate-500'}>{count}</span>;
                        },
                    },
                    {
                        key: 'pending_restocks_count',
                        label: 'Restock',
                        className: 'tabular-nums',
                    },
                ]}
                actions={[
                    { label: 'Detail', variant: 'secondary', onClick: (row) => router.visit(`/owner/outlets/${row.id}`) },
                    { label: 'Edit', variant: 'secondary', onClick: (row) => router.visit(`/owner/outlets/${row.id}/edit`) },
                    { label: 'Inventaris', variant: 'secondary', onClick: (row) => router.visit(`/owner/inventories?outlet_id=${row.id}`) },
                ]}
                emptyMessage="Belum ada outlet"
                emptyAction={{ label: 'Tambah Outlet', href: '/owner/outlets/create' }}
                onRowClick={(row) => router.visit(`/owner/outlets/${row.id}`)}
            />
            <Pagination links={outlets.links} />

            <OutletProvisioningSummary provisioning={flash?.outlet_provisioning} />
        </OwnerPageShell>
    );
}

function getOutletStatus(outlet: any): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
    if (outlet.status !== 'active') {
return { label: 'Nonaktif', variant: 'neutral' };
}

    if (Number(outlet.low_stock_count) > 0) {
return { label: 'Stok Rendah', variant: 'warning' };
}

    if (Number(outlet.active_orders_count) >= 3) {
return { label: 'Sibuk', variant: 'info' as any };
}

    return { label: 'Aktif', variant: 'success' };
}

function Metric({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
    return (
        <div className={`rounded-lg border p-3 ${warn && value > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-[#F8FAFC] text-slate-700'}`}>
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
        </div>
    );
}
