import { router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import SortableTh from '@/components/owner/sortable-th';
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

type SortKey = 'id' | 'outlet' | 'items' | 'date';

export default function OwnerRestocksIndex({ restocks, filters, outlets }: any) {
    const [sortKey, setSortKey] = useState<SortKey>('id');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); } else { setSortKey(key); setSortDir('asc'); }
    };

    if (!restocks || !filters) {
        return <OwnerPageShell title="Restocks" subtitle="Kelola permintaan restock dari outlet"><SkeletonPage /></OwnerPageShell>;
    }

    const currentStatus = filters.status ?? '';

    const setFilter = (key: string, value: string) => {
        router.get('/owner/restocks', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    const handleMarkPreparing = (e: React.MouseEvent, restockId: number) => {
        e.preventDefault(); e.stopPropagation();
        router.post(`/owner/restocks/${restockId}/approve`, {}, { preserveScroll: true });
    };

    const sorted = useMemo(() => [...restocks.data].sort((a: any, b: any) => {
        let av: any, bv: any;

        switch (sortKey) {
            case 'id': av = a.id; bv = b.id; break;
            case 'outlet': av = a.outlet?.name ?? ''; bv = b.outlet?.name ?? ''; break;
            case 'items': av = a.items?.length ?? 0; bv = b.items?.length ?? 0; break;
            case 'date': av = a.created_at ?? ''; bv = b.created_at ?? ''; break;
            default: av = a.id; bv = b.id;
        }

        const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
        return sortDir === 'asc' ? cmp : -cmp;
    }), [restocks.data, sortKey, sortDir]);

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
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${isActive ? colorMap[sf.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'}`}>
                            {sf.label}
                        </button>
                    );
                })}
            </section>

            <OwnerFilterCard
                collapsible defaultExpanded={false}
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
                <EmptyState title="Tidak ada restock" description="Permintaan restock akan muncul di sini setelah diajukan outlet" />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                    <table className="w-full min-w-[600px]" aria-label="Daftar Restock">
                        <thead>
                            <tr className="bg-surface-muted">
                                <SortableTh label="Kode" active={sortKey === 'id'} dir={sortDir} onClick={() => toggleSort('id')} />
                                <SortableTh label="Outlet" active={sortKey === 'outlet'} dir={sortDir} onClick={() => toggleSort('outlet')} />
                                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                                <SortableTh label="Items" active={sortKey === 'items'} dir={sortDir} onClick={() => toggleSort('items')} />
                                <SortableTh label="Tanggal" active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
                                <th className="w-36 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((r: any) => (
                                <tr key={r.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                                    <td className="px-3 py-3 font-bold tabular-nums text-text">#{r.id}</td>
                                    <td className="px-3 py-3 text-text-muted">{r.outlet?.name ?? '—'}</td>
                                    <td className="px-3 py-3"><StatusBadge status={r.status} size="sm" /></td>
                                    <td className="px-3 py-3 text-text-muted">{r.items?.length ?? 0} item</td>
                                    <td className="px-3 py-3 text-text-muted">{formatDate(r.created_at)}</td>
                                    <td className="px-3 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {r.status === 'requested' && (
                                                <Button size="sm" onClick={(e: any) => handleMarkPreparing(e, r.id)}>Approve</Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => router.visit(`/owner/restocks/${r.id}`)}>Detail</Button>
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
