import { router, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import SortableTh from '@/components/owner/sortable-th';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import CentralStockTab from './central-stock-tab';

const TABS = [{ key: 'pusat', label: 'Stok Pusat' }, { key: 'outlet', label: 'Outlet' }] as const;
type TabKey = (typeof TABS)[number]['key'];

type SortKey = 'name' | 'current_stock' | 'minimum_stock' | 'status';

export default function InventoriesIndex({ tab: initialTab, outletSections, stats, centralStock, centralStats }: any) {
    const [activeTab, setActiveTab] = useState<TabKey>((initialTab as TabKey) ?? 'pusat');
    const [editItem, setEditItem] = useState<any>(null);
    const [search, setSearch] = useState('');
    const [outletFilter, setOutletFilter] = useState<string>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const editForm = useForm({ current_stock: 0, minimum_stock: 0, notes: '' });

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); } else { setSortKey(key); setSortDir('asc'); }
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editItem) return;
        editForm.put(`/owner/inventories/${editItem.id}`, { onSuccess: () => { setEditItem(null); editForm.reset(); } });
    };

    const handleTabChange = (t: TabKey) => {
        setActiveTab(t);
        router.get('/owner/inventories', { tab: t }, { preserveState: true, replace: true });
    };

    if (!outletSections && !centralStock) {
        return <OwnerPageShell title="Inventaris" subtitle="Monitor stok seluruh outlet"><SkeletonPage /></OwnerPageShell>;
    }

    // Flatten + group by outlet
    const { outlets, items } = useMemo(() => {
        const all = (outletSections ?? [] as any[]).flatMap((section: any) =>
            section.inventories.map((item: any) => ({
                ...item,
                outlet_name: section.outlet.name,
                outlet_id: section.outlet.id,
            }))
        );

        const uniqueOutlets = [...new Set(all.map((i: any) => i.outlet_name as string))].sort() as string[];

        return { outlets: uniqueOutlets, items: all };
    }, [outletSections]);

    const filtered = useMemo(() => {
        let result = [...items];

        if (search) {
            const q = search.toLowerCase();
            result = result.filter((i: any) =>
                i.outlet_name.toLowerCase().includes(q) ||
                (i.variant?.name ?? '').toLowerCase().includes(q) ||
                (i.variant?.family?.name ?? '').toLowerCase().includes(q)
            );
        }

        if (outletFilter !== 'all') {
            result = result.filter((i: any) => i.outlet_name === outletFilter);
        }

        return result;
    }, [items, search, outletFilter]);

    const sorted = useMemo(() => [...filtered].sort((a: any, b: any) => {
        let av: any, bv: any;

        switch (sortKey) {
            case 'name': av = a.variant?.name ?? ''; bv = b.variant?.name ?? ''; break;
            case 'current_stock': av = a.current_stock; bv = b.current_stock; break;
            case 'minimum_stock': av = a.minimum_stock; bv = b.minimum_stock; break;
            case 'status': av = a.current_stock <= 2 ? 0 : a.current_stock <= a.minimum_stock ? 1 : 2; bv = b.current_stock <= 2 ? 0 : b.current_stock <= b.minimum_stock ? 1 : 2; break;
            default: av = a.variant?.name ?? ''; bv = b.variant?.name ?? '';
        }

        const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
        return sortDir === 'asc' ? cmp : -cmp;
    }), [filtered, sortKey, sortDir]);

    return (
        <OwnerPageShell title="Inventaris" subtitle="Pantau stok semua outlet dan pusat">
            <div className="mb-5 inline-flex rounded-lg bg-surface-muted p-1" role="tablist">
                {TABS.map((t) => (
                    <button key={t.key} type="button" role="tab" aria-selected={activeTab === t.key} onClick={() => handleTabChange(t.key)}
                        className={cn('relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200', activeTab === t.key ? 'bg-white text-text' : 'text-text-muted hover:text-text')}>
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'pusat' && <CentralStockTab variants={centralStock} stats={centralStats} />}

            {activeTab === 'outlet' && (
                <>
                    <OwnerKpiStrip items={[
                        { label: 'Total SKU', value: stats.totalSku },
                        { label: 'Stok Kritis', value: stats.criticalCount, sublabel: stats.criticalCount > 0 ? '≤ 2 pcs' : undefined, sublabelColor: 'text-red-500' },
                        { label: 'Stok Rendah', value: stats.lowCount, sublabel: stats.lowCount > 0 ? '≤ minimum' : undefined, sublabelColor: 'text-amber-500' },
                        { label: 'Stok Sehat', value: stats.healthyCount },
                    ]} />

                    <OwnerFilterCard
                        collapsible defaultExpanded={false}
                        searchPlaceholder="Cari produk atau outlet..."
                        searchValue={search}
                        onSearch={setSearch}
                    >
                        <select value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)}
                            className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20">
                            <option value="all">Semua Outlet</option>
                            {outlets.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </OwnerFilterCard>

                    {sorted.length === 0 ? (
                        <EmptyState title="Tidak ditemukan" description="Coba ubah filter atau kata kunci" />
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                            <table className="w-full min-w-[600px]" aria-label="Stok Outlet">
                                <thead>
                                    <tr className="bg-surface-muted">
                                        <SortableTh label="Produk" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                                        <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Outlet</th>
                                        <SortableTh label="Stok" active={sortKey === 'current_stock'} dir={sortDir} align="right" onClick={() => toggleSort('current_stock')} />
                                        <SortableTh label="Min" active={sortKey === 'minimum_stock'} dir={sortDir} align="right" onClick={() => toggleSort('minimum_stock')} />
                                        <SortableTh label="Status" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
                                        <th className="w-40 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((row: any) => {
                                        const isCritical = row.current_stock <= 2;
                                        const isLow = !isCritical && row.current_stock <= row.minimum_stock;
                                        const variantName = row.variant?.family?.name
                                            ? `${row.variant.family.name} — ${row.variant.name}`
                                            : (row.variant?.name ?? row.product?.name ?? '-');

                                        return (
                                            <tr key={row.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                                                <td className="px-3 py-3">
                                                    <span className="font-bold text-text">{variantName}</span>
                                                    {row.variant?.sku && <span className="ml-1 text-xs text-text-muted">{row.variant.sku}</span>}
                                                </td>
                                                <td className="px-3 py-3 text-sm text-text-muted">{row.outlet_name}</td>
                                                <td className={`px-3 py-3 text-right font-bold tabular-nums ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                    {row.current_stock}
                                                </td>
                                                <td className="px-3 py-3 text-right tabular-nums text-text-muted">{row.minimum_stock}</td>
                                                <td className="px-3 py-3">
                                                    <StatusBadge variant={isCritical ? 'danger' : isLow ? 'warning' : 'success'} size="sm">
                                                        {isCritical ? 'Kritis' : isLow ? 'Rendah' : 'Sehat'}
                                                    </StatusBadge>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {(isCritical || isLow) && (
                                                            <Button size="sm" onClick={() => router.visit(`/owner/restocks/create?outlet_id=${row.outlet_id}&product_id=${row.product_id ?? row.variant_id ?? row.variant?.id}&return_to=/owner/inventories`)}>Restock</Button>
                                                        )}
                                                        <Button variant="ghost" size="sm" onClick={() => { setEditItem(row); editForm.setData({ current_stock: row.current_stock, minimum_stock: row.minimum_stock, notes: '' }); }}>Edit</Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            <Dialog open={editItem !== null} onOpenChange={() => setEditItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Stok</DialogTitle>
                        <DialogDescription>
                            {editItem?.variant?.family?.name && <span>{editItem.variant.family.name} &middot; </span>}
                            {editItem?.variant?.name ?? editItem?.product?.name ?? '-'} — {editItem?.outlet_name}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <Input label="Stok Saat Ini" type="number" min={0} value={editForm.data.current_stock} onChange={(e) => editForm.setData('current_stock', Number(e.target.value))} error={editForm.errors.current_stock} />
                        <Input label="Stok Minimum" type="number" min={0} value={editForm.data.minimum_stock} onChange={(e) => editForm.setData('minimum_stock', Number(e.target.value))} error={editForm.errors.minimum_stock} />
                        <Textarea label="Catatan" value={editForm.data.notes} onChange={(e) => editForm.setData('notes', e.target.value)} error={editForm.errors.notes} />
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditItem(null)}>Batal</Button>
                            <Button type="submit" loading={editForm.processing}>Update</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
