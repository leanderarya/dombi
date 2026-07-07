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
                <>
                    {/* Filter controls */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        {[
                            { key: 'all' as const, label: 'Semua' },
                            { key: 'critical' as const, label: 'Kritis', color: 'text-red-600 bg-red-50 ring-red-200' },
                            { key: 'low' as const, label: 'Rendah', color: 'text-amber-600 bg-amber-50 ring-amber-200' },
                            { key: 'healthy' as const, label: 'Sehat', color: 'text-emerald-600 bg-emerald-50 ring-emerald-200' },
                        ].map((tab) => (
                            <button key={tab.key} type="button" onClick={() => { setStockFilter(tab.key); setCurrentPage(1); }}
                                className={cn(
                                    'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition-all',
                                    stockFilter === tab.key
                                        ? tab.color ?? 'bg-primary/10 text-primary ring-primary/20'
                                        : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                                )}>
                                {tab.label}
                            </button>
                        ))}
                        <span className="flex-1" />
                        <Input icon={Search} type="text" placeholder="Cari outlet atau produk..." value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                            aria-label="Cari inventaris" className="h-8 w-40" />
                        <Select value={outletFilter} onChange={(e) => { setOutletFilter(e.target.value); setCurrentPage(1); }}
                            options={[
                                { value: 'all', label: 'Semua Outlet' },
                                ...outlets.map((outlet: string) => ({ value: outlet, label: outlet })),
                            ]} aria-label="Filter outlet" />
                    </div>

                    {/* KPI Strip */}
                    <div className="mb-4 grid grid-cols-4 gap-2">
                        <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Total SKU</div>
                            <div className="mt-1 text-base font-bold tabular-nums">{stats.totalSku}</div>
                            <div className="text-[10px] font-medium text-text-subtle">Semua outlet</div>
                        </div>
                        <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Stok Rendah</div>
                            <div className="mt-1 text-base font-bold tabular-nums">{stats.lowStock}</div>
                            {stats.lowStock > 0 && <div className="text-[10px] font-medium text-amber-500">Perlu restock</div>}
                        </div>
                        <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Reserved</div>
                            <div className="mt-1 text-base font-bold tabular-nums">{stats.totalReserved}</div>
                            <div className="text-[10px] font-medium text-blue-500">Dalam pesanan</div>
                        </div>
                        <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Kritis</div>
                            <div className="mt-1 text-base font-bold tabular-nums">{stats.critical}</div>
                            {stats.critical > 0 && <div className="text-[10px] font-medium text-red-500">Segera tindak!</div>}
                        </div>
                    </div>

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
                                        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-all',
                                        sortField === col.key
                                            ? 'bg-primary/10 text-primary shadow-sm'
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
                            <div className="grid grid-cols-[1fr_80px_80px_80px_90px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
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
                                        className="grid grid-cols-[1fr_80px_80px_80px_90px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-xs transition-colors last:border-t-0 hover:bg-surface-muted">
                                        <span className="truncate">
                                            {familyName && <span className="text-text-subtle">{familyName} </span>}
                                            <span className="font-bold text-text">{variantName}</span>
                                            <span className="ml-1 text-[10px] text-text-muted">{row.outlet_name}</span>
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
                                                    className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-primary-hover">
                                                    Restock
                                                </button>
                                            )}
                                            <button type="button" onClick={() => router.visit(`/owner/inventories/${row.id}/edit`)}
                                                className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary-light">
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
        if (stockFilter === 'zero' && v.center_stock > 0) return false;
        if (stockFilter === 'low' && (v.center_stock <= 0 || v.center_stock > 10)) return false;
        return true;
    });

    return (
        <>
            {/* Filter controls */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {[
                    { key: 'all' as const, label: 'Semua' },
                    { key: 'zero' as const, label: 'Habis', color: 'text-red-600 bg-red-50 ring-red-200' },
                    { key: 'low' as const, label: 'Rendah', color: 'text-amber-600 bg-amber-50 ring-amber-200' },
                ].map((tab) => (
                    <button key={tab.key} onClick={() => setStockFilter(tab.key)}
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition-all ${
                            stockFilter === tab.key
                                ? tab.color ?? 'bg-primary/10 text-primary ring-primary/20'
                                : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                        }`}>
                        {tab.label}
                    </button>
                ))}
                <span className="flex-1" />
                <Input icon={Search} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari produk atau SKU..." className="h-8 w-48" />
            </div>

            {/* KPI Strip */}
            <div className="mb-4 grid grid-cols-4 gap-2">
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Total Variant</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats.total_variants}</div>
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Total Stok</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats.total_stock} pcs</div>
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Stok Habis</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats.zero_stock}</div>
                    {stats.zero_stock > 0 && <div className="text-[10px] font-medium text-red-500">Perlu tindakan</div>}
                </div>
                <div className="rounded-lg bg-[#f7f7f7] p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Stok Rendah</div>
                    <div className="mt-1 text-base font-bold tabular-nums">{stats.low_stock}</div>
                    {stats.low_stock > 0 && <div className="text-[10px] font-medium text-amber-500">Perlu tindakan</div>}
                </div>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada produk ditemukan
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[1fr_80px_100px_80px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                        <span>Produk / SKU</span><span className="text-right">Stok</span><span className="text-right">HPP</span><span />
                    </div>
                    {filtered.map((v) => {
                        const isZero = v.center_stock <= 0;
                        const isLow = v.center_stock > 0 && v.center_stock <= 10;
                        return (
                            <div key={v.id}
                                className="grid grid-cols-[1fr_80px_100px_80px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-xs transition-colors last:border-t-0 hover:bg-surface-muted">
                                <span className="truncate">
                                    {v.family_name && <span className="text-text-subtle">{v.family_name} </span>}
                                    <span className="font-bold text-text">{v.name}</span>
                                    {v.sku && <span className="ml-1 text-[10px] text-text-muted">{v.sku}</span>}
                                </span>
                                <span className={`text-right font-bold tabular-nums ${isZero ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {v.center_stock} pcs
                                </span>
                                <span className="text-right text-text-muted">{formatCurrency(v.center_price)}</span>
                                <div className="flex items-center gap-1 justify-end">
                                    <button type="button" onClick={() => { setEditModal(v); setNewStock(String(v.center_stock)); setReason(''); }}
                                        className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary-light">
                                        Edit
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

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
        </>
    );
}
