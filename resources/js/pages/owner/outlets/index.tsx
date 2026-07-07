import { Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowDownRight, Clock, Store, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import OutletProvisioningSummary from '@/components/owner/outlet-provisioning-summary';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { buttonVariants } from '@/components/ui/button';
import Pagination from '@/components/ui/pagination';
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
            return outlet.status === 'active';
        case 'inactive':
            return outlet.status !== 'active';
        case 'low_stock':
            return outlet.status === 'active' && Number(outlet.low_stock_count) > 0;
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
                    <div className="mb-3 flex flex-wrap gap-2 overflow-x-auto scrollbar-none">
                        {FILTERS.map((f) => {
                            const isActive = filter === f.key;
                            const colorMap: Record<string, string> = {
                                active: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
                                inactive: 'text-text-muted bg-surface-muted ring-border',
                                low_stock: 'text-amber-600 bg-amber-50 ring-amber-200',
                            };

                            return (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setFilter(f.key)}
                                    className={cn(
                                        'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all',
                                        isActive
                                            ? colorMap[f.key] ?? 'bg-primary/10 text-primary ring-primary/20'
                                            : 'bg-surface text-text-muted ring-border hover:bg-surface-muted',
                                    )}
                                >
                                    {f.label}
                                    {f.key !== 'all' && (
                                        <span className="ml-1 tabular-nums opacity-70">
                                            {f.key === 'active' ? activeOutlets : f.key === 'inactive' ? totalOutlets - activeOutlets : lowStockOutlets}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="space-y-3">
                        {filtered.length === 0 && (
                            <div className="rounded-lg border border-border bg-white p-10 text-center">
                                <p className="text-sm text-text-muted">Belum ada outlet</p>
                                <Link href="/owner/outlets/create" className="mt-2 inline-block text-sm font-semibold text-primary">
                                    + Tambah Outlet
                                </Link>
                            </div>
                        )}
                        {filtered.map((outlet: any) => {
                            const status = getOutletStatus(outlet);
                            const lowStock = Number(outlet.low_stock_count);

                            return (
                                <div
                                    key={outlet.id}
                                    className="cursor-pointer rounded-lg border border-border bg-white p-4 transition-all duration-200"
                                    onClick={() => router.visit(`/owner/outlets/${outlet.id}`)}
                                >
                                    {/* Row 1: name + badge + orders */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-text">{outlet.name}</span>
                                            <StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge>
                                        </div>
                                        <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-bold tabular-nums text-text-muted">
                                            {outlet.active_orders_count} pesanan
                                        </span>
                                    </div>

                                    {/* Row 2: metadata + actions */}
                                    <div className="mt-1.5 flex items-center justify-between">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                                            <span>{outlet.kelurahan} &middot; {outlet.kecamatan}</span>
                                            {lowStock > 0 && (
                                                <>
                                                    <span className="text-text-subtle">&middot;</span>
                                                    <span className="font-bold text-amber-600">{lowStock} stok rendah</span>
                                                </>
                                            )}
                                            {Number(outlet.pending_restocks_count) > 0 && (
                                                <>
                                                    <span className="text-text-subtle">&middot;</span>
                                                    <span>{outlet.pending_restocks_count} restock</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Link
                                                href={`/owner/outlets/${outlet.id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-light"
                                            >
                                                Detail
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={(e) => {
 e.stopPropagation(); router.visit(`/owner/outlets/${outlet.id}/edit`); 
}}
                                                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
 e.stopPropagation(); router.visit(`/owner/inventories?outlet_id=${outlet.id}`); 
}}
                                                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                                            >
                                                Inv
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <Pagination links={outlets.links} />
                </div>

                {/* Right: Summary Sidebar (desktop only) */}
                <aside className="hidden lg:block">
                    <div className="sticky top-4 space-y-3">
                        {/* Total Outlet */}
                        <div className="rounded-lg border border-border bg-white p-5">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Store className="h-4 w-4 text-text-subtle" />
                                Total Outlet
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{totalOutlets}</div>
                            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-text-subtle">
                                Semua outlet
                            </div>
                        </div>

                        {/* Aktif */}
                        <div className="rounded-lg border border-border bg-white p-5">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                                Aktif
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{activeOutlets}</div>
                            {activeOutlets > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-500">
                                    Outlet aktif
                                </div>
                            )}
                        </div>

                        {/* Stok Rendah */}
                        <div className="rounded-lg border border-border bg-white p-5">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                Stok Rendah
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{lowStockOutlets}</div>
                            {lowStockOutlets > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-500">
                                    <ArrowDownRight className="h-3 w-3" />
                                    Perlu restock segera
                                </div>
                            )}
                        </div>

                        {/* Sibuk */}
                        <div className="rounded-lg border border-border bg-white p-5">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Clock className="h-4 w-4 text-blue-500" />
                                Sibuk
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{busyOutlets}</div>
                            {busyOutlets > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-500">
                                    3+ pesanan aktif
                                </div>
                            )}
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

