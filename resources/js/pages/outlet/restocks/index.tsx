import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import RestockStatusBadge from '@/components/restock-status-badge';
import Pagination from '@/components/pagination';
import OutletLayout from '@/layouts/outlet-layout';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'requested', label: 'Diminta' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

export default function OutletRestocksIndex({ restocks, filters }: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get('/outlet/restocks', { status: key || undefined }, { preserveState: true, replace: true });
    };

    return (
        <OutletLayout
            title="Restock"
            headerRight={
                <Link href="/outlet/restocks/create" className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white active:bg-emerald-800">
                    <Plus className="h-4 w-4" />
                    Buat
                </Link>
            }
            headerBelow={
                <FilterChips options={statusFilters} active={activeFilter} onChange={handleFilterChange} />
            }
        >
            <Head title="Restock" />

            {restocks.data.length === 0 ? (
                <EmptyState
                    icon={<ClipboardList className="h-8 w-8 text-slate-400" />}
                    title="Belum ada restock"
                    description={activeFilter ? 'Tidak ada restock dengan filter ini.' : 'Buat request baru untuk meminta stok tambahan.'}
                    action={activeFilter ? { label: 'Reset Filter', onClick: () => handleFilterChange('') } : { label: 'Buat Request Restock', href: '/outlet/restocks/create' }}
                />
            ) : (
                <div className="space-y-2">
                    {restocks.data.map((restock: any) => (
                        <Link key={restock.id} href={`/outlet/restocks/${restock.id}`} className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors active:bg-zinc-50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-bold text-slate-900">Request #{restock.id}</div>
                                <RestockStatusBadge status={restock.status} />
                            </div>
                            <div className="mt-1.5 text-xs text-slate-500">
                                {restock.items?.length ?? 0} item · {restock.distribution?.status ?? 'Menunggu'}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                                {new Date(restock.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
            <Pagination links={restocks.links} />
        </OutletLayout>
    );
}
