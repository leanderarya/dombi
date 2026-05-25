import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import EmptyState from '@/components/empty-state';
import FilterSheet from '@/components/owner/filter-sheet';
import OrderStatusChip from '@/components/owner/order-status-chip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { HeaderIconButton, SearchIcon, FilterIcon } from '@/components/owner/owner-mobile-header';
import Pagination from '@/components/pagination';
import { formatDate } from '@/lib/format';

const statusOptions = [
    { value: 'waiting_pickup', label: 'Waiting Pickup' },
    { value: 'picked_up', label: 'Picked Up' },
    { value: 'delivering', label: 'Delivering' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
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
            title="Deliveries"
            headerRight={
                <>
                    <HeaderIconButton label="Search"><SearchIcon /></HeaderIconButton>
                    <div className="relative">
                        <HeaderIconButton label="Filter" onClick={() => setFilterOpen(true)}><FilterIcon /></HeaderIconButton>
                        {activeFilterCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[9px] font-bold text-white">{activeFilterCount}</span>}
                    </div>
                </>
            }
        >
            {deliveries.data.length === 0 ? (
                <EmptyState icon="🚚" title="Tidak ada delivery" description="Delivery akan muncul setelah kurir di-assign." />
            ) : (
                <div className="space-y-2">
                    {deliveries.data.map((d: any) => (
                        <Link key={d.id} href={`/owner/deliveries/${d.id}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold tabular-nums text-slate-900">{d.order.order_code}</div>
                                <div className="mt-0.5 text-xs text-slate-500">{d.order.outlet?.name ?? '-'} · {d.courier?.name ?? 'No courier'}</div>
                                <div className="mt-1 text-[10px] tabular-nums text-slate-400">{formatDate(d.assigned_at)}</div>
                            </div>
                            <OrderStatusChip status={d.status} />
                        </Link>
                    ))}
                </div>
            )}
            <Pagination links={deliveries.links} />

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    { key: 'status', label: 'Status', options: statusOptions, value: filters.status ?? '' },
                    { key: 'courier_id', label: 'Courier', options: couriers.map((c: any) => ({ value: String(c.id), label: c.name })), value: filters.courier_id ? String(filters.courier_id) : '' },
                ]}
                onApply={handleFilterApply}
            />
        </OwnerPageShell>
    );
}
