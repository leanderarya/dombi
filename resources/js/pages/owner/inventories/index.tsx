import { Link, router } from '@inertiajs/react';
import { AlertTriangle, ArrowUpDown, ChevronDown, ChevronUp, Lock, Package, Search, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

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
    const [stockFilter, setStockFilter] = useState<'all' | 'critical' | 'low' | 'healthy'>('all');
    const [sortField, setSortField] = useState<'outlet' | 'product' | 'stock' | 'available'>('outlet');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const outlets = useMemo(() => {
        const unique = [...new Set(items.map((item: any) => item.outlet_name))];

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
            headerRight={
                <Link href="/owner/inventories/create" className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}>
                    + Tambah Stok
                </Link>
            }
        >
            {/* Segmented Control */}
            <div className="mb-5 inline-flex rounded-xl bg-surface-muted p-1">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => handleTabChange(t.key)}
                        className={`relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                            activeTab === t.key ? 'bg-white text-text shadow-sm' : 'text-text-muted hover:text-text'
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
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                {/* Left: Filters + List */}
                <div>
                    {/* Stock level filter tabs */}
                    <div className="mb-4 flex flex-wrap gap-2">
                        {[
                            { key: 'all' as const, label: 'Semua' },
                            { key: 'critical' as const, label: 'Kritis', color: 'text-red-600 bg-red-50 ring-red-200' },
                            { key: 'low' as const, label: 'Rendah', color: 'text-amber-600 bg-amber-50 ring-amber-200' },
                            { key: 'healthy' as const, label: 'Sehat', color: 'text-emerald-600 bg-emerald-50 ring-emerald-200' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => {
 setStockFilter(tab.key); setCurrentPage(1); 
}}
                                className={cn(
                                    'rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all',
                                    stockFilter === tab.key
                                        ? tab.color ?? 'bg-primary/10 text-primary ring-primary/20'
                                        : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Search + Outlet filter */}
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Input
                            icon={Search}
                            type="text"
                            placeholder="Cari outlet atau produk..."
                            value={search}
                            onChange={(e) => {
 setSearch(e.target.value); setCurrentPage(1); 
}}
                            aria-label="Cari inventaris"
                            className="flex-1"
                        />
                        <Select
                            value={outletFilter}
                            onChange={(e) => {
 setOutletFilter(e.target.value); setCurrentPage(1); 
}}
                            options={[
                                { value: 'all', label: 'Semua Outlet' },
                                ...outlets.map((outlet: string) => ({ value: outlet, label: outlet })),
                            ]}
                            aria-label="Filter outlet"
                        />
                    </div>

                    {/* Sort Bar */}
                    {paginatedItems.length > 0 && (
                        <div className="mb-3 flex flex-wrap items-center gap-1.5">
                            <span className="mr-1 text-xs text-text-subtle">Urutkan:</span>
                            {[
                                { key: 'outlet' as const, label: 'Outlet' },
                                { key: 'product' as const, label: 'Produk' },
                                { key: 'stock' as const, label: 'Stok' },
                                { key: 'available' as const, label: 'Tersedia' },
                            ].map((col) => (
                                <button
                                    key={col.key}
                                    type="button"
                                    onClick={() => toggleSort(col.key)}
                                    className={cn(
                                        'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                                        sortField === col.key
                                            ? 'bg-primary/10 text-primary shadow-sm'
                                            : 'bg-surface text-text-muted hover:bg-surface-muted'
                                    )}
                                >
                                    {col.label}
                                    {sortField === col.key && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                    {sortField !== col.key && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Card List */}
                    {paginatedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-16 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted">
                                <Package className="h-7 w-7 text-text-subtle" />
                            </div>
                            <p className="mt-4 text-sm font-semibold text-text">
                                {search || outletFilter !== 'all' || stockFilter !== 'all'
                                    ? 'Tidak ada item yang cocok'
                                    : 'Belum ada inventaris'}
                            </p>
                            <p className="mt-1 text-xs text-text-muted">
                                {search || outletFilter !== 'all' || stockFilter !== 'all'
                                    ? 'Coba ubah filter atau kata kunci pencarian'
                                    : 'Mulai dengan menambahkan stok ke outlet'}
                            </p>
                            {!search && outletFilter === 'all' && stockFilter === 'all' && (
                                <Link href="/owner/inventories/create" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'mt-4')}>
                                    + Tambah Stok
                                </Link>
                            )}
                            {(search || outletFilter !== 'all' || stockFilter !== 'all') && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="mt-4"
                                    onClick={() => {
 setSearch(''); setOutletFilter('all'); setStockFilter('all'); setCurrentPage(1); 
}}
                                >
                                    Reset Filter
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {paginatedItems.map((row: any) => {
                                const familyName = row.variant?.family?.name;
                                const variantName = row.variant?.name ?? row.product?.name ?? '-';
                                const available = row.current_stock - row.reserved_stock;
                                const isCritical = available <= 0;
                                const isLow = available <= row.minimum_stock;

                                return (
                                    <div
                                        key={row.id}
                                        className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm"
                                    >
                                        {/* Row 1: product + badge + actions */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-text">
                                                    {familyName && <span className="mr-1 text-xs text-text-subtle">{familyName}</span>}
                                                    {variantName}
                                                </span>
                                                <StatusBadge variant={isCritical ? 'danger' : isLow ? 'warning' : 'success'} size="sm">
                                                    {isCritical ? 'Kritis' : isLow ? 'Rendah' : 'Sehat'}
                                                </StatusBadge>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {(isCritical || isLow) && (
                                                    <button
                                                        onClick={() => router.visit(`/owner/restocks/create?outlet_id=${row.outlet_id}&product_id=${row.product_id ?? row.variant_id}&return_to=/owner/inventories`)}
                                                        className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white active:opacity-90"
                                                    >
                                                        Restock
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => router.visit(`/owner/inventories/${row.id}/edit`)}
                                                    className="rounded-lg px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-light"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        </div>

                                        {/* Row 2: outlet + stats */}
                                        <div className="mt-1.5 flex items-center justify-between">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                                                <span>{row.outlet_name}</span>
                                                <span className="text-text-subtle">&middot;</span>
                                                <span>Stok: <span className="tabular-nums">{row.current_stock}</span></span>
                                                <span className="text-text-subtle">&middot;</span>
                                                <span>Reserved: <span className="tabular-nums">{row.reserved_stock}</span></span>
                                            </div>
                                            <span className={cn('text-xs font-bold tabular-nums', isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600')}>
                                                {available} tersedia
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3">
                            <span className="text-sm text-text-muted">
                                Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} dari {filteredItems.length} item
                            </span>
                            <div className="flex gap-2">
                                <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                    Sebelumnya
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: KPI Cards (desktop sidebar) */}
                <div className="hidden lg:block">
                    <div className="sticky top-4 space-y-3">
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Package className="h-4 w-4 text-text-subtle" />
                                Total SKU
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{stats.totalSku}</div>
                            <div className="mt-1 text-[11px] font-medium text-text-subtle">Semua outlet</div>
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                Stok Rendah
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{stats.lowStock}</div>
                            <div className="mt-1 text-[11px] font-medium text-amber-500">{stats.lowStock > 0 ? 'Perlu restock' : 'Semua aman'}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <Lock className="h-4 w-4 text-blue-500" />
                                Reserved
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{stats.totalReserved}</div>
                            <div className="mt-1 text-[11px] font-medium text-blue-500">Dalam pesanan</div>
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <XCircle className="h-4 w-4 text-red-500" />
                                Kritis
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{stats.critical}</div>
                            <div className="mt-1 text-[11px] font-medium text-red-500">{stats.critical > 0 ? 'Segera tindak!' : 'Tidak ada'}</div>
                        </div>
                    </div>
                </div>

                {/* Mobile: KPI Summary */}
                <div className="mb-4 grid grid-cols-2 gap-3 lg:hidden">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <Package className="h-4 w-4 text-text-subtle" />
                            Total SKU
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{stats.totalSku}</div>
                        <div className="mt-1 text-[11px] font-medium text-text-subtle">Semua outlet</div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Stok Rendah
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{stats.lowStock}</div>
                        <div className="mt-1 text-[11px] font-medium text-amber-500">{stats.lowStock > 0 ? 'Perlu restock' : 'Semua aman'}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <Lock className="h-4 w-4 text-blue-500" />
                            Reserved
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{stats.totalReserved}</div>
                        <div className="mt-1 text-[11px] font-medium text-blue-500">Dalam pesanan</div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <XCircle className="h-4 w-4 text-red-500" />
                            Kritis
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{stats.critical}</div>
                        <div className="mt-1 text-[11px] font-medium text-red-500">{stats.critical > 0 ? 'Segera tindak!' : 'Tidak ada'}</div>
                    </div>
                </div>
            </div>
            )}
        </OwnerPageShell>
    );
}

/* ================================================================== */
/*  Stok Pusat Tab                                                     */
/* ================================================================== */

function CentralStockTab({ variants, stats }: { variants?: any[]; stats?: any }) {
    const [search, setSearch] = useState('');
    const [stockFilter, setStockFilter] = useState<'all' | 'zero' | 'low'>('all');
    const [editModal, setEditModal] = useState<any>(null);
    const [newStock, setNewStock] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    if (!variants || !stats) {
        return <div className="h-20 animate-pulse rounded-xl border border-border bg-white" />;
    }

    const filtered = variants.filter((v) => {
        if (search) {
            const q = search.toLowerCase();

            if (!v.name.toLowerCase().includes(q) && !(v.sku ?? '').toLowerCase().includes(q)) {
return false;
}
        }

        if (stockFilter === 'zero' && v.center_stock > 0) {
return false;
}

        if (stockFilter === 'low' && (v.center_stock <= 0 || v.center_stock > 10)) {
return false;
}

        return true;
    });

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            <div>
                {/* Filters */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-2 [&>input]:pl-2">
                        <Search className="h-4 w-4 shrink-0 text-text-subtle" />
                        <Input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari produk atau SKU..."
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: 'all' as const, label: 'Semua' },
                            { key: 'zero' as const, label: 'Habis', color: 'text-red-600 bg-red-50 ring-red-200' },
                            { key: 'low' as const, label: 'Rendah', color: 'text-amber-600 bg-amber-50 ring-amber-200' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setStockFilter(tab.key)}
                                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                    stockFilter === tab.key
                                        ? tab.color ?? 'bg-primary/10 text-primary ring-primary/20'
                                        : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="space-y-2">
                    {filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-white py-12 text-center">
                            <Package className="mx-auto h-8 w-8 text-text-subtle" />
                            <p className="mt-2 text-sm text-text-muted">Tidak ada produk ditemukan</p>
                        </div>
                    ) : (
                        filtered.map((v) => (
                            <div key={v.id} className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-text">{v.name}</span>
                                        {v.sku && <span className="text-[11px] text-text-subtle">{v.sku}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-bold tabular-nums ${v.center_stock <= 0 ? 'text-red-600' : v.center_stock <= 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {v.center_stock} pcs
                                        </span>
                                        <button
                                            onClick={() => {
 setEditModal(v); setNewStock(String(v.center_stock)); setReason(''); 
}}
                                            className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-light"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-1.5 flex items-center gap-x-3 text-xs text-text-muted">
                                    <span>{v.family_name ?? '-'}</span>
                                    <span className="text-text-subtle">&middot;</span>
                                    <span>HPP: {formatCurrency(v.center_price)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* KPI Sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    <KpiCard icon={<Package className="h-4 w-4 text-text-subtle" />} label="Total Variant" value={stats.total_variants} />
                    <KpiCard icon={<Package className="h-4 w-4 text-emerald-500" />} label="Total Stok Pusat" value={`${stats.total_stock} pcs`} />
                    <KpiCard icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="Stok Habis" value={stats.zero_stock} highlight={stats.zero_stock > 0} />
                    <KpiCard icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Stok Rendah" value={stats.low_stock} highlight={stats.low_stock > 0} />
                </div>
            </aside>

            {/* Edit Modal */}
            {editModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditModal(null)}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-text">Edit Stok Pusat</h3>
                        <p className="mt-1 text-sm text-text-muted">{editModal.name}</p>

                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-text-muted">Stok Saat Ini</label>
                                <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">
                                    {editModal.center_stock} pcs
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-text-muted">Stok Baru</label>
                                <input
                                    type="number"
                                    value={newStock}
                                    onChange={(e) => setNewStock(e.target.value)}
                                    min="0"
                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-text-muted">Alasan</label>
                                <select
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                                >
                                    <option value="">Pilih alasan...</option>
                                    <option value="Stok opname">Stok Opname</option>
                                    <option value="Produk rusak">Produk Rusak</option>
                                    <option value="Produk expired">Produk Expired</option>
                                    <option value="Penerimaan supplier">Penerimaan Supplier</option>
                                    <option value="Koreksi manual">Koreksi Manual</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setEditModal(null)}
                                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-surface-muted"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSaving(true);
                                    router.patch(`/owner/inventories/central-stock/${editModal.id}`, {
                                        center_stock: parseInt(newStock),
                                        reason: reason || undefined,
                                    }, {
                                        onFinish: () => {
                                            setSaving(false);
                                            setEditModal(null);
                                        },
                                    });
                                }}
                                disabled={saving || parseInt(newStock) === editModal.center_stock}
                                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                            >
                                {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function KpiCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }) {
    return (
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-text-muted">{icon}{label}</div>
            <div className="mt-2 text-3xl font-bold tabular-nums text-text">{value}</div>
            {highlight && <div className="mt-1 text-[11px] font-medium text-red-500">Perlu tindakan</div>}
        </div>
    );
}
