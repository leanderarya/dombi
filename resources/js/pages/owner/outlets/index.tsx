import { Link, router, usePage } from '@inertiajs/react';
import { Pencil, Store } from 'lucide-react';
import { useState } from 'react';
import OutletProvisioningSummary from '@/components/owner/outlet-provisioning-summary';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { buttonVariants } from '@/components/ui/button';
import DataTable from '@/components/ui/data-table';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

type FilterKey = 'all' | 'active' | 'inactive' | 'low_stock';

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Aktif' },
    { key: 'inactive', label: 'Nonaktif' },
    { key: 'low_stock', label: 'Stok Rendah' },
];

function matchesFilter(outlet: any, filter: FilterKey): boolean {
    switch (filter) {
        case 'active':
            return outlet.status === 'active' && Number(outlet.low_stock_count) === 0;
        case 'inactive':
            return outlet.status !== 'active';
        case 'low_stock':
            return Number(outlet.low_stock_count) > 0;
        default:
            return true;
    }
}

export default function OutletsIndex({ outlets }: any) {
    const { flash } = usePage<any>().props;
    const [filter, setFilter] = useState<FilterKey>('active');
    const filtered = outlets.data.filter((o: any) => matchesFilter(o, filter));
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

            {/* Filter Tabs */}
            <div className="mb-3 flex gap-1.5 overflow-x-auto">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
                        className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                            filter === f.key
                                ? 'bg-text text-white'
                                : 'bg-surface-muted text-text-muted hover:bg-border',
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <DataTable
                rowKey="id"
                data={filtered}
                columns={[
                    {
                        key: 'name',
                        label: 'Outlet',
                        className: 'font-bold text-text',
                        render: (row: any) => (
                            <div>
                                <div>{row.name}</div>
                                <div className="text-[11px] text-text-muted">{row.kelurahan} · {row.kecamatan}</div>
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

                            return <span className={count > 0 ? 'font-bold text-amber-600' : 'text-text-muted'}>{count}</span>;
                        },
                    },
                    {
                        key: 'pending_restocks_count',
                        label: 'Restock',
                        className: 'tabular-nums',
                    },
                    {
                        key: 'edit',
                        label: '',
                        className: 'w-px',
                        render: (row: any) => (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); router.visit(`/owner/outlets/${row.id}/edit`); }}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
                                title="Edit"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                        ),
                    },
                ]}
                actions={[
                    { label: 'Detail', variant: 'secondary', onClick: (row) => router.visit(`/owner/outlets/${row.id}`) },
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
        <div className={`rounded-lg border p-3 ${warn && value > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-border bg-surface-muted text-text-muted'}`}>
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
        </div>
    );
}
