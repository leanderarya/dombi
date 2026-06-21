import { Link, router } from '@inertiajs/react';
import { AlertTriangle, Box, ChevronDown, ChevronUp, Lock, Search, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

export default function InventoriesIndex({ outletSections, stats }: any) {
    // Flatten all inventory items for desktop table
    const items = useMemo(() =>
        outletSections.flatMap((section: any) =>
            section.inventories.map((item: any) => ({
                ...item,
                outlet_name: section.outlet.name,
                outlet_id: section.outlet.id,
                health: section.health,
            }))
        ), [outletSections]);

    // State for search, filters, sort, and pagination
    const [search, setSearch] = useState('');
    const [outletFilter, setOutletFilter] = useState<string>('all');
    const [stockFilter, setStockFilter] = useState<'all' | 'critical' | 'low' | 'healthy'>('all');
    const [sortField, setSortField] = useState<'outlet' | 'product' | 'stock' | 'available'>('outlet');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    // Get unique outlets for filter dropdown
    const outlets = useMemo(() => {
        const unique = [...new Set(items.map((item: any) => item.outlet_name))];

        return unique.sort();
    }, [items]);

    const filteredItems = useMemo(() => {
        let result = [...items];

        // Search filter
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter((item: any) =>
                item.outlet_name.toLowerCase().includes(searchLower) ||
                (item.variant?.name ?? item.product?.name ?? '').toLowerCase().includes(searchLower) ||
                (item.variant?.family?.name ?? '').toLowerCase().includes(searchLower)
            );
        }

        // Outlet filter
        if (outletFilter !== 'all') {
            result = result.filter((item: any) => item.outlet_name === outletFilter);
        }

        // Stock level filter
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

        // Sort
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

    // Pagination
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
            {/* KPI Summary */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <OwnerKpiCard
                    icon={<Box className="h-5 w-5" />}
                    label="Total SKU"
                    value={stats.totalSku}
                />
                <OwnerKpiCard
                    icon={<AlertTriangle className="h-5 w-5" />}
                    label="Stok Rendah"
                    value={stats.lowStock}
                    color="warning"
                />
                <OwnerKpiCard
                    icon={<Lock className="h-5 w-5" />}
                    label="Reserved"
                    value={stats.totalReserved}
                    color="info"
                />
                <OwnerKpiCard
                    icon={<XCircle className="h-5 w-5" />}
                    label="Kritis"
                    value={stats.critical}
                    color="danger"
                />
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Search */}
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

                {/* Outlet filter */}
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

                {/* Stock level filter */}
                <Select
                    value={stockFilter}
                    onChange={(e) => {
                        setStockFilter(e.target.value as any); setCurrentPage(1);
                    }}
                    options={[
                        { value: 'all', label: 'Semua Stok' },
                        { value: 'critical', label: 'Kritis (0)' },
                        { value: 'low', label: 'Rendah' },
                        { value: 'healthy', label: 'Sehat' },
                    ]}
                    aria-label="Filter stok"
                />
            </div>

            {/* Table */}
            {paginatedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-12 text-center">
                    <div className="text-text-subtle"><Box className="h-8 w-8" /></div>
                    <p className="mt-2 text-sm font-medium text-slate-600">
                        {search || outletFilter !== 'all' || stockFilter !== 'all' ? 'Tidak ada item yang cocok' : 'Belum ada inventaris'}
                    </p>
                    {!search && outletFilter === 'all' && stockFilter === 'all' && (
                        <div className="mt-3">
                            <Link href="/owner/inventories/create" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
                                Tambah Stok
                            </Link>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Sort Bar */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-text-muted">Urutkan:</span>
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
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                    sortField === col.key
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-surface text-text-muted hover:bg-zinc-100'
                                }`}
                            >
                                {col.label}
                                {sortField === col.key && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                            </button>
                        ))}
                    </div>

                    {/* Card List */}
                    <div className="space-y-2">
                        {paginatedItems.map((row: any) => {
                            const familyName = row.variant?.family?.name;
                            const variantName = row.variant?.name ?? row.product?.name ?? '-';
                            const available = row.current_stock - row.reserved_stock;
                            const isCritical = available <= 0;
                            const isLow = available <= row.minimum_stock;

                            return (
                                <div key={row.id} className="rounded-xl border border-border bg-surface p-4">
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
                                        <span className={`font-bold tabular-nums ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-text'}`}>
                                            Tersedia: {available}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 mt-4 rounded-xl border border-border bg-surface">
                    <span className="text-sm text-text-muted">
                        Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} dari {filteredItems.length} item
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            Sebelumnya
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Berikutnya
                        </Button>
                    </div>
                </div>
            )}
        </OwnerPageShell>
    );
}
