import { router } from '@inertiajs/react';
import { Truck } from 'lucide-react';
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
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
];

type SortKey = 'id' | 'outlet' | 'items' | 'date';

export default function OwnerDistributionsIndex({ distributions, filters, outlets }: any) {
    const [sortKey, setSortKey] = useState<SortKey>('id');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); } else { setSortKey(key); setSortDir('asc'); }
    };

    if (!distributions || !filters) {
        return <OwnerPageShell title="Distribusi" subtitle="Kelola distribusi stok ke outlet"><SkeletonPage /></OwnerPageShell>;
    }

    const currentStatus = filters.status ?? '';

    const setFilter = (key: string, value: string) => {
        router.get('/owner/distributions', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    const handleMarkShipped = (e: React.MouseEvent, distributionId: number) => {
        e.preventDefault(); e.stopPropagation();
        router.post(`/owner/distributions/${distributionId}/mark-shipped`, {}, { preserveScroll: true });
    };

    const sorted = useMemo(() => [...distributions.data].sort((a: any, b: any) => {
        let av: any, bv: any;

        switch (sortKey) {
            case 'id': av = a.id; bv = b.id; break;
            case 'outlet': av = a.outlet?.name ?? ''; bv = b.outlet?.name ?? ''; break;
            case 'items': av = a.items?.length ?? 0; bv = b.items?.length ?? 0; break;
            case 'date': av = a.sent_at ?? ''; bv = b.sent_at ?? ''; break;
            default: av = a.id; bv = b.id;
        }

        const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
        return sortDir === 'asc' ? cmp : -cmp;
    }), [distributions.data, sortKey, sortDir]);

    const preparingCount = distributions.data.filter((d: any) => d.status === 'preparing').length;
    const shippedCount = distributions.data.filter((d: any) => d.status === 'shipped').length;
    const completedCount = distributions.data.filter((d: any) => d.status === 'completed').length;

    return (
        <OwnerPageShell title="Distribusi" subtitle="Kelola distribusi stok ke outlet">
            <OwnerKpiStrip items={[
                { label: 'Disiapkan', value: preparingCount, sublabel: preparingCount > 0 ? 'Siap dikirim' : undefined, sublabelColor: 'text-amber-600' },
                { label: 'Dalam Perjalanan', value: shippedCount, sublabel: shippedCount > 0 ? 'Sedang dikirim' : undefined, sublabelColor: 'text-blue-600' },
                { label: 'Selesai', value: completedCount },
            ]} />

            <section className="mb-4 flex flex-wrap items-center gap-2" aria-label="Filter Status">
                {statusFilters.map((sf) => {
                    const isActive = currentStatus === sf.key;
                    const colorMap: Record<string, string> = {
                        '': 'text-text bg-surface-muted ring-border',
                        preparing: 'text-purple-600 bg-purple-50 ring-purple-200',
                        shipped: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
                        completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
                    };

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

            {distributions.data.length === 0 ? (
                <EmptyState title="Tidak ada distribusi" description="Distribusi akan muncul di sini setelah stok dikirim ke outlet" />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                    <table className="w-full min-w-[600px]" aria-label="Daftar Distribusi">
                        <thead>
                            <tr className="bg-surface-muted">
                                <SortableTh label="Kode" active={sortKey === 'id'} dir={sortDir} onClick={() => toggleSort('id')} />
                                <SortableTh label="Outlet" active={sortKey === 'outlet'} dir={sortDir} onClick={() => toggleSort('outlet')} />
                                <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                                <SortableTh label="Items" active={sortKey === 'items'} dir={sortDir} onClick={() => toggleSort('items')} />
                                <SortableTh label="Tanggal" active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
                                <th className="w-28 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((d: any) => (
                                <tr key={d.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                                    <td className="px-3 py-3 font-bold tabular-nums text-text">#{d.id}</td>
                                    <td className="px-3 py-3 text-text-muted">{d.outlet?.name ?? '—'}</td>
                                    <td className="px-3 py-3"><StatusBadge status={d.status} size="sm" /></td>
                                    <td className="px-3 py-3 text-text-muted">{d.items?.length ?? 0} item</td>
                                    <td className="px-3 py-3 text-text-muted">{d.sent_at ? formatDate(d.sent_at) : 'Belum dikirim'}</td>
                                    <td className="px-3 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {d.status === 'preparing' && (
                                                <Button size="sm" onClick={(e: any) => handleMarkShipped(e, d.id)}>
                                                    <Truck className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Kirim
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => router.visit(`/owner/distributions/${d.id}`)}>Detail</Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination links={distributions.links} />
        </OwnerPageShell>
    );
}
