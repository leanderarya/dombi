import { router } from '@inertiajs/react';
import { Package } from 'lucide-react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'requested', label: 'Butuh Tindakan' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
];

const colorMap: Record<string, string> = {
    '': 'text-text bg-surface-muted ring-border',
    requested: 'text-amber-600 bg-amber-50 ring-amber-200',
    preparing: 'text-purple-600 bg-purple-50 ring-purple-200',
    shipped: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
    completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
};

export default function OwnerRestocksIndex({ restocks, filters, outlets }: any) {
    if (!restocks || !filters) {
        return (
            <OwnerPageShell title="Restocks" subtitle="Kelola permintaan restock dari outlet">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const currentStatus = filters.status ?? '';

    const setFilter = (key: string, value: string) => {
        router.get(
            '/owner/restocks',
            { ...filters, [key]: value || undefined },
            { preserveState: true, replace: true },
        );
    };

    const handleMarkPreparing = (e: React.MouseEvent, restockId: number) => {
        e.preventDefault();
        e.stopPropagation();
        router.post(`/owner/restocks/${restockId}/approve`, {}, { preserveScroll: true });
    };

    const requestedCount = restocks.data.filter((r: any) => r.status === 'requested').length;
    const preparingCount = restocks.data.filter((r: any) => r.status === 'preparing').length;
    const shippedCount = restocks.data.filter((r: any) => r.status === 'shipped').length;
    const completedCount = restocks.data.filter((r: any) => r.status === 'completed').length;

    return (
        <OwnerPageShell title="Restocks" subtitle="Kelola permintaan restock dari outlet">
            <OwnerKpiStrip items={[
                { label: 'Menunggu', value: requestedCount, sublabel: requestedCount > 0 ? 'Perlu ditinjau' : undefined, sublabelColor: 'text-amber-600' },
                { label: 'Disiapkan', value: preparingCount },
                { label: 'Dikirim', value: shippedCount },
                { label: 'Selesai', value: completedCount },
            ]} />

            <section className="mb-4 flex flex-wrap items-center gap-2" aria-label="Filter Status">
                {statusFilters.map((sf) => {
                    const isActive = currentStatus === sf.key;

                    return (
                        <button key={sf.key} type="button" onClick={() => setFilter('status', sf.key)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                isActive ? colorMap[sf.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}>
                            {sf.label}
                        </button>
                    );
                })}
            </section>

            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari kode..."
                searchValue={filters.search ?? ''}
                onSearch={(val) => setFilter('search', val)}
                outletOptions={outlets?.map((o: any) => ({ value: String(o.id), label: o.name }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => setFilter('outlet_id', val)}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => setFilter('date', val)}
            />

            {restocks.data.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8" aria-hidden="true" />}
                    title="Tidak ada restock"
                    description="Permintaan restock akan muncul di sini setelah diajukan outlet"
                />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                    <table className="w-full min-w-[600px]" aria-label="Daftar Restock">
                        <thead>
                            <tr className="bg-surface-muted">
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Kode</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Outlet</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Items</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Tanggal</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {restocks.data.map((r: any) => (
                                <tr key={r.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                                    <td className="px-4 py-3 font-bold tabular-nums text-text">#{r.id}</td>
                                    <td className="px-4 py-3 text-text-muted">{r.outlet?.name ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={r.status} size="sm" />
                                    </td>
                                    <td className="px-4 py-3 text-text-muted">{r.items?.length ?? 0} item</td>
                                    <td className="px-4 py-3 text-text-muted">{formatDate(r.created_at)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            {r.status === 'requested' && (
                                                <Button size="sm" onClick={(e: any) => handleMarkPreparing(e, r.id)}>
                                                    Approve
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => router.visit(`/owner/restocks/${r.id}`)}>
                                                Detail
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination links={restocks.links} />
        </OwnerPageShell>
    );
}
