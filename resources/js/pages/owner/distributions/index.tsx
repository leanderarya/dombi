import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Package } from 'lucide-react';
import EmptyState from '@/components/empty-state';
import FilterSheet from '@/components/owner/filter-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { HeaderIconButton, FilterIcon } from '@/components/owner/owner-mobile-header';
import Pagination from '@/components/pagination';
import { formatDate } from '@/lib/format';

const statusOptions = [
    { value: 'preparing', label: 'Preparing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'completed', label: 'Completed' },
];
const statusStyles: Record<string, string> = {
    preparing: 'bg-orange-50 text-orange-700 border-orange-200',
    shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function OwnerDistributionsIndex({ distributions, outlets, filters }: any) {
    const [filterOpen, setFilterOpen] = useState(false);
    const activeFilterCount = [filters.status, filters.outlet_id].filter(Boolean).length;

    const handleFilterApply = (f: Record<string, string>) => {
        router.get('/owner/distributions', { status: f.status || undefined, outlet_id: f.outlet_id || undefined }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell
            title="Distributions"
            headerRight={
                <div className="relative">
                    <HeaderIconButton label="Filter" onClick={() => setFilterOpen(true)}><FilterIcon /></HeaderIconButton>
                    {activeFilterCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[9px] font-bold text-white">{activeFilterCount}</span>}
                </div>
            }
        >
            {distributions.data.length === 0 ? (
                <EmptyState icon={<Package className="h-8 w-8 text-slate-400" />} title="Tidak ada distribution" description="Distribution dibuat setelah restock disetujui." />
            ) : (
                <div className="space-y-2">
                    {distributions.data.map((d: any) => (
                        <Link key={d.id} href={`/owner/distributions/${d.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                            <div>
                                <div className="text-sm font-bold text-slate-900">#{d.id}</div>
                                <div className="mt-0.5 text-xs text-slate-500">{d.outlet.name}</div>
                                <div className="mt-1 text-[10px] tabular-nums text-slate-400">{d.sent_at ? formatDate(d.sent_at) : 'Belum dikirim'}</div>
                            </div>
                            <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusStyles[d.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>{d.status}</span>
                        </Link>
                    ))}
                </div>
            )}
            <Pagination links={distributions.links} />

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    { key: 'status', label: 'Status', options: statusOptions, value: filters.status ?? '' },
                    { key: 'outlet_id', label: 'Outlet', options: outlets.map((o: any) => ({ value: String(o.id), label: o.name })), value: filters.outlet_id ? String(filters.outlet_id) : '' },
                ]}
                onApply={handleFilterApply}
            />
        </OwnerPageShell>
    );
}
