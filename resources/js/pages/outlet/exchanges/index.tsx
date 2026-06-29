import { Head, Link, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import ExchangeCreateDialog from '@/components/outlet/exchange-create-dialog';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import Pagination from '@/components/pagination';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'submitted', label: 'Diajukan' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'received', label: 'Diterima' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

export default function OutletExchangesIndex({ exchanges, filters, variants, outletInventory, pendingReturns }: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');
    const [showCreate, setShowCreate] = useState(false);

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get('/outlet/exchanges', key ? { status: key } : {}, { preserveState: true, replace: true });
    };

    return (
        <OutletLayout
            title="Tukar Produk"
            headerBelow={<FilterChips options={statusFilters} active={activeFilter} onChange={handleFilterChange} />}
        >
            <Head title="Tukar Produk" />

            {/* Action Bar */}
            <div className="mt-4 mb-4 flex justify-end">
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-white active:opacity-80"
                >
                    <Plus className="h-4 w-4" />
                    Ajukan Tukar
                </button>
            </div>

            <div className="space-y-2">
                {exchanges.data.length === 0 ? (
                    <EmptyState
                        title="Belum ada pengajuan tukar produk"
                        description="Ajukan tukar produk untuk produk pengganti."
                        action={{ label: 'Ajukan Tukar', onClick: () => setShowCreate(true) }}
                    />
                ) : (
                    exchanges.data.map((ex: any) => (
                        <Link
                            key={ex.id}
                            href={`/outlet/exchanges/${ex.id}`}
                            className="block rounded-xl border border-border bg-white p-4 active:opacity-80"
                        >
                            <div className="flex items-start justify-between">
                                <div className="text-sm font-semibold text-text">Tukar Produk #{ex.id}</div>
                                <StatusBadge status={ex.status} />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                                <span>{ex.items?.length ?? 0} item pengganti</span>
                                <span className="font-semibold text-text">{formatCurrency(ex.exchange_value)}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-text-subtle">{formatDate(ex.created_at)}</div>
                        </Link>
                    ))
                )}
            </div>

            <Pagination links={exchanges.links} />
            <div className="h-24" />

            {/* Create Exchange Dialog */}
            <ExchangeCreateDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                variants={variants}
                outletInventory={outletInventory}
            />
        </OutletLayout>
    );
}
