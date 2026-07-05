import { Head, Link, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import ReturnCreateDialog from '@/components/outlet/return-create-dialog';
import Pagination from '@/components/pagination';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'submitted', label: 'Diajukan' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'rejected', label: 'Ditolak' },
    { key: 'received_at_center', label: 'Diterima Pusat' },
    { key: 'completed', label: 'Selesai' },
];

export default function OutletReturnsIndex({ returns, filters, variants, reasons }: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');
    const [showCreate, setShowCreate] = useState(false);

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get('/outlet/returns', key ? { status: key } : {}, { preserveState: true, replace: true });
    };

    return (
        <OutletLayout
            title="Return"
            headerBelow={<FilterChips options={statusFilters} active={activeFilter} onChange={handleFilterChange} />}
        >
            <Head title="Return" />
            <OutletPageShell hasStickyBar>
            {/* Action Bar */}
            <div className="flex justify-end">
                <Button size="lg" onClick={() => setShowCreate(true)} icon={Plus}>
                    Ajukan Return
                </Button>
            </div>

            {/* List */}
            <div className="space-y-2">
                {returns.data.length === 0 ? (
                    <EmptyState
                        title="Belum ada pengajuan return"
                        description="Ajukan return untuk produk tidak terjual atau rusak."
                        action={{ label: 'Ajukan Return', onClick: () => setShowCreate(true) }}
                    />
                ) : (
                    returns.data.map((ret: any) => (
                        <Link
                            key={ret.id}
                            href={`/outlet/returns/${ret.id}`}
                            className="block rounded-xl border border-border bg-white p-4 active:opacity-80"
                        >
                            <div className="flex items-start justify-between">
                                <div className="text-sm font-semibold text-text">Return #{ret.id}</div>
                                <StatusBadge status={ret.status} />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                                <span>{ret.items?.length ?? 0} item</span>
                                <span className="font-semibold tabular-nums text-text">{formatCurrency(ret.total_value)}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-text-subtle">{formatDate(ret.created_at)}</div>
                        </Link>
                    ))
                )}
            </div>

            <Pagination links={returns.links} />
            </OutletPageShell>

            {/* Create Return Dialog */}
            <ReturnCreateDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                variants={variants}
                reasons={reasons}
            />
        </OutletLayout>
    );
}
