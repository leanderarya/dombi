import { router } from '@inertiajs/react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import CentralStockTab from './central-stock-tab';

const TABS = [
    { key: 'pusat', label: 'Stok Pusat' },
    { key: 'outlet', label: 'Outlet' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function InventoriesIndex({ tab: initialTab, outletSections, stats, centralStock, centralStats }: any) {
    const [activeTab, setActiveTab] = useState<TabKey>((initialTab as TabKey) ?? 'pusat');

    if (!outletSections && !centralStock) {
        return (
            <OwnerPageShell title="Inventaris" subtitle="Monitor stok seluruh outlet">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const items = useMemo(() =>
        outletSections.flatMap((section: any) =>
            section.inventories.map((item: any) => ({
                ...item,
                outlet_name: section.outlet.name,
                outlet_id: section.outlet.id,
                health: section.health,
            }))
        ), [outletSections]);

    const [search, setSearch] = useState('');
    const [outletFilter, setOutletFilter] = useState<string>('all');
    const [stockFilter] = useState<'all' | 'critical' | 'low' | 'healthy'>('all');
    const [sortField, setSortField] = useState<'outlet' | 'product' | 'stock' | 'available'>('outlet');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const outlets = useMemo((): string[] => {
        const unique = [...new Set(items.map((item: any) => item.outlet_name as string))] as string[];

        return unique.sort();
    }, [items]);

    const filteredItems = useMemo(() => {
        let result = [...items];

        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter((item: any) =>
                item.outlet_name.toLowerCase().includes(searchLower) ||
                (item.variant?.name ?? item.product?.name ?? '').toLowerCase().includes(searchLower) ||
                (item.variant?.family?.name ?? '').toLowerCase().includes(searchLower)
            );
        }

        if (outletFilter !== 'all') {
            result = result.filter((item: any) => item.outlet_name === outletFilter);
        }

        if (stockFilter !== 'all') {
            result = result.filter((item: any) => {
                const available = item.current_stock - item.reserved_stock;

                switch (stockFilter) {
                    case 'critical': return available <= 0;
                    case 'low': return available > 0 && available <= item.minimum_stock;
                    case 'healthy': return available > item.minimum_stock;
                    default: return true;
                }
            });
        }

        result.sort((a: any, b: any) => {
            let cmp = 0;

            switch (sortField) {
                case 'outlet':
                    cmp = a.outlet_name.localeCompare(b.outlet_name);
                    break;
                case 'product':
                    cmp = (a.variant?.name ?? '').localeCompare(b.variant?.name ?? '');
                    break;
                case 'stock':
                    cmp = a.current_stock - b.current_stock;
                    break;
                case 'available':
                    cmp = (a.current_stock - a.reserved_stock) - (b.current_stock - b.reserved_stock);
                    break;
            }

            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [items, search, outletFilter, stockFilter, sortField, sortDir]);

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const paginatedItems = filteredItems.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const handleTabChange = (t: TabKey) => {
        setActiveTab(t);
        router.get('/owner/inventories', { tab: t }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell
            title="Inventaris"
            subtitle="Pantau stok semua outlet dan pusat"
        >
            {/* Segmented Control */}
            <div className="mb-5 inline-flex rounded-lg bg-surface-muted p-1">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => handleTabChange(t.key)}
                        className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                            activeTab === t.key ? 'bg-white text-text' : 'text-text-muted hover:text-text'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'pusat' && (
                <CentralStockTab variants={centralStock} stats={centralStats} />
            )}

            {activeTab === 'outlet' && (
                <>
                    {/* Filter controls */}
                    <OwnerFilterCard
                        searchPlaceholder="Cari outlet atau produk..."
                        searchValue={search}
                        onSearch={(val) => {
 setSearch(val); setCurrentPage(1); 
}}
                        outletOptions={outlets.map((outlet: string) => ({ value: outlet, label: outlet }))}
                        outletValue={outletFilter}
                        onOutletChange={(val) => {
 setOutletFilter(val); setCurrentPage(1); 
}}
                        tambahHref="/owner/inventories/create"
                        tambahLabel="Tambah Stok"
                    />

                    {/* KPI Strip */}
                    <OwnerKpiStrip items={[
                        { label: 'Total SKU', value: stats.totalSku, sublabel: 'Semua outlet', sublabelColor: 'text-text-subtle' },
                        { label: 'Stok Rendah', value: stats.lowStock, sublabel: stats.lowStock > 0 ? 'Perlu restock' : undefined, sublabelColor: 'text-amber-500' },
                        { label: 'Reserved', value: stats.totalReserved, sublabel: 'Dalam pesanan', sublabelColor: 'text-blue-500' },
                        { label: 'Kritis', value: stats.critical, sublabel: stats.critical > 0 ? 'Segera tindak!' : undefined, sublabelColor: 'text-red-500' },
                    ]} />

                    {/* Sort Bar */}
                    {paginatedItems.length > 0 && (
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <span className="mr-1 text-xs text-text-subtle">Urutkan:</span>
                            {[
                                { key: 'outlet' as const, label: 'Outlet' },
                                { key: 'product' as const, label: 'Produk' },
                                { key: 'stock' as const, label: 'Stok' },
                                { key: 'available' as const, label: 'Tersedia' },
                            ].map((col) => (
                                <button key={col.key} type="button" onClick={() => toggleSort(col.key)}
                                    className={cn(
                                        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all',
                                        sortField === col.key
                                            ? 'bg-primary/10 text-primary'
                                            : 'bg-surface text-text-muted hover:bg-surface-muted'
                                    )}>
                                    {col.label}
                                    {sortField === col.key && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                    {sortField !== col.key && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Table */}
                    {paginatedItems.length === 0 ? (
                        <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                            {search || outletFilter !== 'all' || stockFilter !== 'all'
                                ? 'Tidak ada item yang cocok'
                                : 'Belum ada inventaris'}
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-border">
                            <div className="grid grid-cols-[1fr_80px_80px_80px_90px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                                <span>Produk / Outlet</span><span className="text-right">Stok</span><span className="text-right">Threshold</span><span>Status</span><span />
                            </div>
                            {paginatedItems.map((row: any) => {
                                const familyName = row.variant?.family?.name;
                                const variantName = row.variant?.name ?? row.product?.name ?? '-';
                                const available = row.current_stock - row.reserved_stock;
                                const isCritical = available <= 0;
                                const isLow = available <= row.minimum_stock;

                                return (
                                    <div key={row.id}
                                        className="grid grid-cols-[1fr_80px_80px_80px_90px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-sm transition-colors last:border-t-0 hover:bg-surface-muted">
                                        <span className="truncate">
                                            {familyName && <span className="text-text-subtle">{familyName} </span>}
                                            <span className="font-bold text-text">{variantName}</span>
                                            <span className="ml-1 text-xs text-text-muted">{row.outlet_name}</span>
                                        </span>
                                        <span className="text-right font-semibold tabular-nums text-text">{row.current_stock}</span>
                                        <span className="text-right tabular-nums text-text-muted">{row.minimum_stock}</span>
                                        <span>
                                            <StatusBadge variant={isCritical ? 'danger' : isLow ? 'warning' : 'success'} size="sm">
                                                {isCritical ? 'Kritis' : isLow ? 'Rendah' : 'Sehat'}
                                            </StatusBadge>
                                        </span>
                                        <div className="flex items-center gap-1 justify-end">
                                            {(isCritical || isLow) && (
                                                <button type="button" onClick={() => router.visit(`/owner/restocks/create?outlet_id=${row.outlet_id}&product_id=${row.product_id ?? row.variant_id}&return_to=/owner/inventories`)}
                                                    className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-white hover:bg-primary-hover">
                                                    Restock
                                                </button>
                                            )}
                                            <button type="button" onClick={() => router.visit(`/owner/inventories/${row.id}/edit`)}
                                                className="rounded-md px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary-light">
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-xs">
                            <span className="text-text-muted">
                                {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} dari {filteredItems.length}
                            </span>
                            <div className="flex gap-1.5">
                                <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                    ←
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                    →
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </OwnerPageShell>
    );
}
