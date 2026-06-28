import { Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowDownRight, Box, Clock, Package, Pencil, Store, TrendingUp } from 'lucide-react';
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
    const totalOutlets = outlets.data.length;
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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                {/* Left: List */}
                <div>
                    {/* Filter Tabs */}
                    <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {FILTERS.map((f) => (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setFilter(f.key)}
                                className={cn(
                                    'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
                                    filter === f.key
                                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                        : 'bg-surface-muted text-text-muted hover:bg-zinc-200',
                                )}
                            >
                                {f.label}
                                {f.key !== 'all' && (
                                    <span className="ml-1 tabular-nums opacity-70">
                                        {f.key === 'active' ? activeOutlets : f.key === 'inactive' ? totalOutlets - activeOutlets : lowStockOutlets}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <DataTable
                        rowKey="id"
                        data={filtered}
                        rowClassName=""
                        columns={[
                            {
                                key: 'name',
                                label: 'Outlet',
                                className: 'font-bold text-text',
                                render: (row: any) => (
                                    <div>
                                        <div>{row.name}</div>
                                        <div className="text-[11px] text-text-muted">{row.kelurahan} &middot; {row.kecamatan}</div>
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
                </div>

                {/* Right: Summary Sidebar (desktop only) */}
                <aside className="hidden lg:block">
                    <div className="sticky top-4 space-y-3">
                        {/* Total Outlet */}
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Store className="h-4 w-4 text-text-subtle" />
                                Total Outlet
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{totalOutlets}</div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-text-subtle">
                                Semua outlet
                            </div>
                        </div>

                        {/* Aktif */}
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                                Aktif
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{activeOutlets}</div>
                            {activeOutlets > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                                    Outlet aktif
                                </div>
                            )}
                        </div>

                        {/* Stok Rendah */}
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                Stok Rendah
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{lowStockOutlets}</div>
                            {lowStockOutlets > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-500">
                                    <ArrowDownRight className="h-3 w-3" />
                                    Perlu restock segera
                                </div>
                            )}
                        </div>

                        {/* Sibuk */}
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Clock className="h-4 w-4 text-blue-500" />
                                Sibuk
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{busyOutlets}</div>
                            {busyOutlets > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-500">
                                    3+ pesanan aktif
                                </div>
                            )}
                        </div>

                        {/* Quick Tips */}
                        <div className="rounded-xl border border-border bg-white p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Tips</h3>
                            <ul className="mt-2 space-y-2 text-xs text-text-muted">
                                <li className="flex items-start gap-2">
                                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                                    Outlet aktif tanpa stok rendah
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                                    Perlu restock segera
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                                    Sedang sibuk (3+ pesanan aktif)
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                                    Nonaktif / diarsipkan
                                </li>
                            </ul>
                        </div>
                    </div>
                </aside>
            </div>

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

