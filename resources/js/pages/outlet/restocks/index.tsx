import { Head, Link, router } from '@inertiajs/react';
import { Plus, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import Pagination from '@/components/pagination';
import RestockCreateDialog from '@/components/outlet/restock-create-dialog';
import StatusBadge from '@/components/ui/status-badge';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import OutletLayout from '@/layouts/outlet-layout';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'requested', label: 'Diminta' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

export default function OutletRestocksIndex({ restocks, filters, families, inventories }: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');
    const [showCreate, setShowCreate] = useState(false);

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get('/outlet/restocks', { status: key || undefined }, { preserveState: true, replace: true });
    };

    return (
        <OutletLayout
            title="Restock"
            headerBelow={
                <FilterChips options={statusFilters} active={activeFilter} onChange={handleFilterChange} />
            }
        >
            <Head title="Restock" />

            {/* Action Bar */}
            <div className="mt-4 mb-4 flex justify-end">
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-white active:opacity-80"
                >
                    <Plus className="h-4 w-4" />
                    Buat Restock
                </button>
            </div>

            {restocks.data.length === 0 ? (
                <EmptyState
                    icon={<ClipboardList className="h-8 w-8 text-text-subtle" />}
                    title="Belum ada restock"
                    description={activeFilter ? 'Tidak ada restock dengan filter ini.' : 'Buat request baru untuk meminta stok tambahan.'}
                    action={activeFilter ? { label: 'Reset Filter', onClick: () => handleFilterChange('') } : { label: 'Buat Request Restock', onClick: () => setShowCreate(true) }}
                />
            ) : (
                <div className="space-y-2">
                    {restocks.data.map((restock: any) => (
                        <Link key={restock.id} href={`/outlet/restocks/${restock.id}`} className="block rounded-xl border border-border bg-white p-4 transition-colors active:bg-surface-muted">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-bold text-text">Request #{restock.id}</div>
                                <StatusBadge status={restock.status} />
                            </div>
                            <div className="mt-1.5 text-xs text-text-muted">
                                {restock.items?.length ?? 0} item · {restock.distribution?.status ?? 'Menunggu'}
                            </div>
                            <div className="mt-1 text-xs text-text-subtle">
                                {new Date(restock.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
            <Pagination links={restocks.links} />

            {/* Create Restock Dialog */}
            <RestockCreateDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                families={families}
                inventories={inventories}
            />
        </OutletLayout>
    );
}
