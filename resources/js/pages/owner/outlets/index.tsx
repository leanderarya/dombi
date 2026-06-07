import { Link, router, usePage } from '@inertiajs/react';
import { Store } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OutletProvisioningSummary from '@/components/owner/outlet-provisioning-summary';
import Pagination from '@/components/pagination';
import DataTable from '@/components/ui/data-table';
import StatusBadge from '@/components/ui/status-badge';

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
                <Link href="/owner/outlets/create" className="flex h-9 items-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800">
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

            {/* Mobile: cards */}
            <div className="lg:hidden">
                {outlets.data.length === 0 ? (
                    <EmptyState icon={<Store className="h-8 w-8 text-slate-400" />} title="Belum ada outlet" description="Tambah outlet pertama dengan memilih titik lokasi di peta." />
                ) : (
                    <div className="space-y-3">
                        {outlets.data.map((outlet: any) => <OutletCard key={outlet.id} outlet={outlet} />)}
                    </div>
                )}
                <Pagination links={outlets.links} />
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block">
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
            </div>

            <OutletProvisioningSummary provisioning={flash?.outlet_provisioning} />
        </OwnerPageShell>
    );
}

function getOutletStatus(outlet: any): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
    if (outlet.status !== 'active') return { label: 'Nonaktif', variant: 'neutral' };
    if (Number(outlet.low_stock_count) > 0) return { label: 'Stok Rendah', variant: 'warning' };
    if (Number(outlet.active_orders_count) >= 3) return { label: 'Sibuk', variant: 'info' as any };
    return { label: 'Aktif', variant: 'success' };
}

function OutletCard({ outlet }: { outlet: any }) {
    const status = getOutletStatus(outlet);

    return (
        <Link href={`/owner/outlets/${outlet.id}`} className="block rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-900">{outlet.name}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">{outlet.kelurahan} · {outlet.kecamatan}</p>
                </div>
                <StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-4 text-slate-500">{outlet.address}</p>
            <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                <MetricMini value={outlet.active_orders_count ?? 0} label="Aktif" />
                <MetricMini value={outlet.low_stock_count ?? 0} label="Rendah" warn={Number(outlet.low_stock_count) > 0} />
                <MetricMini value={outlet.pending_restocks_count ?? 0} label="Restock" />
            </div>
        </Link>
    );
}

function Metric({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
    return (
        <div className={`rounded-lg border p-3 ${warn && value > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-[#F8FAFC] text-slate-700'}`}>
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
        </div>
    );
}

function MetricMini({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
    return (
        <div className={`rounded-lg border px-2 py-1 ${warn ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-[#F8FAFC] text-slate-600'}`}>
            <div className="font-semibold tabular-nums">{value}</div>
            <div>{label}</div>
        </div>
    );
}
