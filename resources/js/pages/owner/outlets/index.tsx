import { Link, router, usePage } from '@inertiajs/react';
import { Building } from 'lucide-react';
import { useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OutletProvisioningSummary from '@/components/owner/outlet-provisioning-summary';
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
            return (
                outlet.status === 'active' && Number(outlet.low_stock_count) > 0
            );
        default:
            return true;
    }
}

function getOutletStatus(outlet: any): {
    label: string;
    variant: 'success' | 'warning' | 'danger' | 'neutral';
} {
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
            <OwnerPageShell
                title="Outlet"
                subtitle="Kelola seluruh outlet Dombi"
            >
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const totalOutlets = outlets.data.length;
    const activeOutlets = outlets.data.filter(
        (o: any) => o.status === 'active',
    ).length;
    const lowStockOutlets = outlets.data.filter(
        (o: any) => Number(o.low_stock_count) > 0,
    ).length;

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

    const filters: { key: FilterKey; label: string }[] = [
        { key: 'all', label: `Semua (${totalOutlets})` },
        { key: 'active', label: `Aktif (${activeOutlets})` },
        {
            key: 'inactive',
            label: `Nonaktif (${totalOutlets - activeOutlets})`,
        },
        { key: 'low_stock', label: `Stok Rendah (${lowStockOutlets})` },
    ];

    return (
        <OwnerPageShell
            title="Outlet"
            subtitle="Kelola seluruh outlet Dombi"
            headerRight={
                <Link
                    href="/owner/outlets/create"
                    className={cn(
                        buttonVariants({ variant: 'primary', size: 'md' }),
                    )}
                >
                    + Tambah Outlet
                </Link>
            }
        >
            {/* Filter Bar */}
            <OwnerFilterCard
                searchPlaceholder="Cari outlet..."
                searchValue={search}
                onSearch={setSearch}
            />
            <div className="mb-4 flex flex-wrap gap-2">
                {filters.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                            filter === f.key
                                ? 'bg-primary/10 text-primary ring-primary/20'
                                : 'bg-surface text-text-muted ring-border hover:bg-mint-wash'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Outlet Cards Grid */}
            {filtered.length === 0 ? (
                <EmptyState
                    icon={<Building className="h-8 w-8" />}
                    title="Belum ada outlet"
                    description="Klik tambah untuk mendaftarkan outlet pertama"
                    action={{
                        label: '+ Tambah Outlet',
                        href: '/owner/outlets/create',
                    }}
                />
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((outlet: any) => {
                            const status = getOutletStatus(outlet);
                            const lowStock = Number(outlet.low_stock_count);

                            return (
                                <div
                                    key={outlet.id}
                                    className="group rounded-2xl border border-border bg-surface p-5 transition-all hover:border-primary/30 hover:shadow-card"
                                >
                                    {/* Header */}
                                    <div className="mb-3 flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                                {outlet.name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-text">
                                                    {outlet.name}
                                                </h3>
                                                <p className="text-xs text-text-muted">
                                                    {outlet.kelurahan},{' '}
                                                    {outlet.kecamatan}
                                                </p>
                                            </div>
                                        </div>
                                        <StatusBadge
                                            variant={status.variant}
                                            size="sm"
                                        >
                                            {status.label}
                                        </StatusBadge>
                                    </div>

                                    {/* Divider */}
                                    <div className="mb-3 border-t border-border" />

                                    {/* Stats Grid */}
                                    <div className="mb-4 grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-surface-muted/50 px-3 py-2">
                                            <div className="text-[10px] font-medium text-text-muted">
                                                Pesanan
                                            </div>
                                            <div className="text-sm font-bold text-text tabular-nums">
                                                {outlet.active_orders_count}
                                            </div>
                                        </div>
                                        <div className="rounded-lg bg-surface-muted/50 px-3 py-2">
                                            <div className="text-[10px] font-medium text-text-muted">
                                                Stok Rendah
                                            </div>
                                            <div
                                                className={`text-sm font-bold tabular-nums ${
                                                    lowStock > 0
                                                        ? 'text-amber-600'
                                                        : 'text-text'
                                                }`}
                                            >
                                                {lowStock}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() =>
                                                router.visit(
                                                    `/owner/outlets/${outlet.id}`,
                                                )
                                            }
                                        >
                                            Detail
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() =>
                                                router.visit(
                                                    `/owner/outlets/${outlet.id}/edit`,
                                                )
                                            }
                                        >
                                            Edit
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <Pagination links={outlets.links} />
                </>
            )}

            <OutletProvisioningSummary
                provisioning={flash?.outlet_provisioning}
            />
        </OwnerPageShell>
    );
}
