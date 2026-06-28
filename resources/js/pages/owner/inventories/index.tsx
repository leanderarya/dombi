import { Link, router } from '@inertiajs/react';
import { AlertTriangle, ArrowUpDown, ChevronDown, ChevronUp, Lock, Package, Search, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

export default function InventoriesIndex({ outletSections, stats }: any) {
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
                                onClick={() => { setStockFilter(tab.key); setCurrentPage(1); }}
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
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                            aria-label="Cari inventaris"
                            className="flex-1"
                        />
                        <Select
                            value={outletFilter}
                            onChange={(e) => { setOutletFilter(e.target.value); setCurrentPage(1); }}
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
                                    onClick={() => { setSearch(''); setOutletFilter('all'); setStockFilter('all'); setCurrentPage(1); }}
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
                                        className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-md"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="text-xs font-medium text-text-muted">{row.outlet_name}</div>
                                                <div className="font-semibold text-text">
                                                    {familyName && <span className="mr-1 text-[11px] text-text-subtle">{familyName}</span>}
                                                    {variantName}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <StatusBadge variant={isCritical ? 'danger' : isLow ? 'warning' : 'success'} size="sm">
                                                    {isCritical ? 'Kritis' : isLow ? 'Rendah' : 'Sehat'}
                                                </StatusBadge>
                                                {(isCritical || isLow) && (
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => router.visit(`/owner/restocks/create?outlet_id=${row.outlet_id}&product_id=${row.product_id ?? row.variant_id}`)}
                                                    >
                                                        Restock
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => router.visit(`/owner/inventories/${row.id}/edit`)}
                                                >
                                                    Edit
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                            <span className="text-text-muted">Stok: <span className="tabular-nums">{row.current_stock}</span></span>
                                            <span className="text-text-muted">Reserved: <span className="tabular-nums">{row.reserved_stock}</span></span>
                                            <span className={cn('font-bold tabular-nums', isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600')}>
                                                Tersedia: {available}
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
        </OwnerPageShell>
    );
}
