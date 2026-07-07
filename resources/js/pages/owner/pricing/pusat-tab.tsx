import { DollarSign, Package, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatMarginPercent } from '@/lib/format';
import { marginColor } from '@/lib/pricing-utils';
import { GlobalPriceModal } from './pricing-modals';
import { EmptyState, LoadingSkeleton, PaginationBar, SortBar, Toolbar } from './pricing-shared';
import type { MarginFilter, PusatKpis, PusatVariant, SortDir, SortKey } from './types';

export function PusatTab({ variants, kpis }: { variants?: PusatVariant[]; kpis?: PusatKpis }) {
    const [search, setSearch] = useState('');
    const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<PusatVariant | null>(null);

    if (!variants || !kpis) {
        return <LoadingSkeleton />;
    }

    const filtered = useMemo(() => {
        return variants.filter((v) => {
            if (search) {
                const q = search.toLowerCase();

                if (!v.name.toLowerCase().includes(q) && !(v.family_name ?? '').toLowerCase().includes(q)) {
                    return false;
                }
            }

            if (marginFilter === 'high' && v.margin <= 20000) {
                return false;
            }

            if (marginFilter === 'low' && (v.margin < 5000 || v.margin > 20000)) {
                return false;
            }

            if (marginFilter === 'negative' && v.margin >= 0) {
                return false;
            }

            return true;
        });
    }, [variants, search, marginFilter]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            const cmp = typeof aVal === 'string' ? aVal.localeCompare(String(bVal)) : Number(aVal) - Number(bVal);

            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sortKey, sortDir]);

    const perPage = 20;
    const totalPages = Math.ceil(sorted.length / perPage);
    const paginated = sorted.slice((page - 1) * perPage, page * perPage);

    const toggleSort = useCallback(
        (key: SortKey) => {
            if (sortKey === key) {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            } else {
                setSortKey(key); setSortDir('asc');
            }

            setPage(1);
        },
        [sortKey],
    );

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            <div>
                <Toolbar
                    search={search}
                    onSearchChange={(v) => {
 setSearch(v); setPage(1); 
}}
                    marginFilter={marginFilter}
                    onMarginFilterChange={(v) => {
 setMarginFilter(v); setPage(1); 
}}
                />

                <SortBar sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />

                <div className="space-y-2">
                    {paginated.map((v) => (
                        <div key={v.variant_id} className="rounded-lg border border-border bg-white p-4 transition-all duration-200">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-lg font-bold text-text">{v.name}</div>
                                    {v.outlet_override_count > 0 && (
                                        <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-600">
                                            {v.outlet_override_count} outlet override
                                        </span>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
 setSelectedVariant(v); setModalOpen(true); 
}}
                                    className="shrink-0 text-primary"
                                >
                                    Ubah
                                </Button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <span className="text-text-muted">
                                    HPP: <span className="tabular-nums text-text">{formatCurrency(v.center_price)}</span>
                                </span>
                                <span className="text-text-muted">
                                    Jual: <span className="font-semibold tabular-nums text-text">{formatCurrency(v.selling_price)}</span>
                                </span>
                                <span className={`font-bold tabular-nums ${marginColor(v.margin, v.selling_price)}`}>
                                    {formatCurrency(v.margin)} {formatMarginPercent(v.margin, v.selling_price)}
                                </span>
                            </div>
                        </div>
                    ))}
                    {paginated.length === 0 && (
                        <EmptyState message={search || marginFilter !== 'all' ? 'Produk tidak ditemukan.' : 'Belum ada produk aktif.'} />
                    )}
                </div>

                {totalPages > 1 && <PaginationBar page={page} totalPages={totalPages} total={sorted.length} onPageChange={setPage} />}
            </div>

            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    <OwnerKpiCard label="Total Produk" value={kpis.total_variants} icon={<Package className="h-5 w-5" />} />
                    <OwnerKpiCard label="Rata-rata HPP" value={formatCurrency(kpis.avg_hpp)} icon={<DollarSign className="h-5 w-5" />} />
                    <OwnerKpiCard label="Rata-rata Margin" value={formatCurrency(kpis.avg_margin)} icon={<TrendingUp className="h-5 w-5" />} />
                    <OwnerKpiCard
                        label="Margin Negatif"
                        value={kpis.negative_margin_count}
                        icon={<TrendingDown className="h-5 w-5" />}
                        highlight={kpis.negative_margin_count > 0}
                    />
                </div>
            </aside>

            {selectedVariant && (
                <GlobalPriceModal
                    open={modalOpen}
                    variant={selectedVariant}
                    onClose={() => {
 setModalOpen(false); setSelectedVariant(null); 
}}
                />
            )}
        </div>
    );
}
