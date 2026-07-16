import { Link, router, usePage } from '@inertiajs/react';
import { Store } from 'lucide-react';
import { useState } from 'react';
import OutletProvisioningSummary from '@/components/owner/outlet-provisioning-summary';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

type FilterKey = 'all' | 'active' | 'inactive' | 'low_stock';

function matchesFilter(outlet: any, filter: FilterKey): boolean {
    switch (filter) {
        case 'active':
            return outlet.status === 'active';
        case 'inactive':
            return outlet.status !== 'active';
        case 'low_stock':
            return outlet.status === 'active' && Number(outlet.low_stock_count) > 0;
        default:
            return true;
    }
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

export default function OutletsIndex({ outlets }: any) {
    const { flash } = usePage<any>().props;
    const [filter, setFilter] = useState<FilterKey>('active');
    const [search, setSearch] = useState('');

    if (!outlets?.data) {
        return (
            <OwnerPageShell title="Outlet" subtitle="Manajemen cabang operasional">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const totalOutlets = outlets.data.length;
    const activeOutlets = outlets.data.filter((o: any) => o.status === 'active').length;
    const lowStockOutlets = outlets.data.filter((o: any) => Number(o.low_stock_count) > 0).length;
    const busyOutlets = outlets.data.filter((o: any) => Number(o.active_orders_count) >= 3).length;

    let filtered = outlets.data.filter((o: any) => matchesFilter(o, filter));

    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
            (o: any) =>
                o.name.toLowerCase().includes(q) ||
                o.kelurahan?.toLowerCase().includes(q) ||
                o.kecamatan?.toLowerCase().includes(q),
        );
    }

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
            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari outlet..."
                searchValue={search}
                onSearch={(val) => setSearch(val)}
            >
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as FilterKey)}
                    className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                >
                    <option value="all">Semua ({totalOutlets})</option>
                    <option value="active">Aktif ({activeOutlets})</option>
                    <option value="inactive">Nonaktif ({totalOutlets - activeOutlets})</option>
                    <option value="low_stock">Stok Rendah ({lowStockOutlets})</option>
                </select>
            </OwnerFilterCard>

            <OwnerKpiStrip
                cols={4}
                items={[
                    { label: 'Total Outlet', value: totalOutlets, sublabel: 'Semua outlet', sublabelColor: 'text-text-subtle' },
                    { label: 'Aktif', value: activeOutlets, sublabel: 'Outlet aktif', sublabelColor: 'text-emerald-500' },
                    { label: 'Stok Rendah', value: lowStockOutlets, sublabel: lowStockOutlets > 0 ? 'Perlu restock' : undefined, sublabelColor: 'text-amber-500' },
                    { label: 'Sibuk', value: busyOutlets, sublabel: busyOutlets > 0 ? '3+ pesanan aktif' : undefined, sublabelColor: 'text-blue-500' },
                ]}
            />

            {filtered.length === 0 ? (
                <EmptyState
                    icon={<Store className="h-8 w-8" />}
                    title="Belum ada outlet"
                    description="Tambah outlet untuk mulai mengelola cabang"
                    action={{ label: '+ Tambah Outlet', href: '/owner/outlets/create' }}
                />
            ) : (
                <div className="overflow-x-auto rounded-xl bg-surface shadow-card" aria-label="Daftar Outlet">
                    <table className="w-full min-w-[600px]">
                        <thead>
                            <tr className="bg-surface-muted/50">
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Outlet</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Lokasi</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Pesanan</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((outlet: any) => {
                                const status = getOutletStatus(outlet);
                                const lowStock = Number(outlet.low_stock_count);

                                return (
                                    <tr
                                        key={outlet.id}
                                        className="cursor-pointer border-t border-border/20 transition-colors hover:bg-mint-wash"
                                        onClick={() => router.visit(`/owner/outlets/${outlet.id}`)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-muted">
                                                    {outlet.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-text">{outlet.name}</div>
                                                    {lowStock > 0 && (
                                                        <div className="text-xs font-bold text-amber-600">{lowStock} stok rendah</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-text-muted">
                                            {outlet.kelurahan} &middot; {outlet.kecamatan}
                                            {Number(outlet.pending_restocks_count) > 0 && (
                                                <span className="ml-1">&middot; {outlet.pending_restocks_count} restock</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-bold tabular-nums text-text-muted">
                                                {outlet.active_orders_count}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.visit(`/owner/outlets/${outlet.id}`);
                                                    }}
                                                >
                                                    Detail
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.visit(`/owner/outlets/${outlet.id}/edit`);
                                                    }}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.visit(`/owner/inventories?outlet_id=${outlet.id}`);
                                                    }}
                                                >
                                                    Inv
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination links={outlets.links} />

            <OutletProvisioningSummary provisioning={flash?.outlet_provisioning} />
        </OwnerPageShell>
    );
}
