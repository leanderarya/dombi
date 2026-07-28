import { DollarSign, Package, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MarginBarInline } from '@/components/owner';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerTable from '@/components/owner/owner-table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { GlobalPriceModal } from './pricing-modals';
import { PaginationBar } from './pricing-shared';
import type {
    MarginFilter,
    PusatKpis,
    PusatVariant,
    SortDir,
    SortKey,
} from './types';

function SortMarker({
    col,
    activeCol,
    direction,
}: {
    col: SortKey;
    activeCol: SortKey;
    direction: SortDir;
}) {
    return activeCol === col ? (
        <span className="ml-0.5 text-[10px] text-primary">
            {direction === 'asc' ? '▲' : '▼'}
        </span>
    ) : null;
}

export function PusatTab({
    variants,
    products,
    kpis,
}: {
    variants?: PusatVariant[]; // backward compat
    products?: PusatVariant[];
    kpis?: PusatKpis;
}) {
    const [search, setSearch] = useState('');
    const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<PusatVariant | null>(
        null,
    );

    const productRows = useMemo(
        () => products ?? variants ?? [],
        [products, variants],
    );
    const filtered = useMemo(
        () =>
            productRows.filter((v) => {
                if (search) {
                    const q = search.toLowerCase();
                    const haystack = [
                        v.name,
                        v.category_name,
                        v.family_name,
                        v.sku,
                        v.flavor,
                        v.size,
                    ]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();

                    if (!haystack.includes(q)) {
                        // also check margin as string for live search?
                        if (
                            !String(v.margin).includes(q) &&
                            !String(v.center_price).includes(q) &&
                            !String(v.selling_price).includes(q)
                        ) {
                            return false;
                        }
                    }
                }

                if (marginFilter === 'high' && v.margin <= 20000) {
                    return false;
                }

                if (
                    marginFilter === 'low' &&
                    (v.margin < 5000 || v.margin > 20000)
                ) {
                    return false;
                }

                if (marginFilter === 'negative' && v.margin >= 0) {
                    return false;
                }

                return true;
            }),
        [productRows, search, marginFilter],
    );

    const sorted = useMemo(
        () =>
            [...filtered].sort((a, b) => {
                const av = a[sortKey],
                    bv = b[sortKey];
                const cmp =
                    typeof av === 'string'
                        ? av.localeCompare(String(bv))
                        : Number(av) - Number(bv);

                return sortDir === 'asc' ? cmp : -cmp;
            }),
        [filtered, sortKey, sortDir],
    );

    const perPage = 20,
        totalPages = Math.ceil(sorted.length / perPage);
    const paginated = sorted.slice((page - 1) * perPage, page * perPage);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }

        setPage(1);
    };

    const maxMargin = useMemo(
        () => Math.max(...sorted.map((v) => v.margin), 1),
        [sorted],
    );

    if ((!variants && !products) || !kpis) {
        return <SkeletonList count={5} />;
    }

    const kpiItems = [
        {
            label: 'Total Produk',
            value: kpis.total_products ?? kpis.total_variants ?? 0,
            icon: <Package className="h-5 w-5" />,
        },
        {
            label: 'Rata-rata HPP',
            value: formatCurrency(kpis.avg_hpp),
            icon: <DollarSign className="h-5 w-5" />,
        },
        {
            label: 'Rata-rata Margin',
            value: formatCurrency(kpis.avg_margin),
            icon: <TrendingUp className="h-5 w-5" />,
        },
        {
            label: 'Margin Negatif',
            value: kpis.negative_margin_count,
            icon: <TrendingDown className="h-5 w-5" />,
            valueClassName:
                kpis.negative_margin_count > 0 ? 'text-red-600' : undefined,
        },
    ];

    return (
        <div>
            <OwnerKpiStrip items={kpiItems} cols={4} />

            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari produk..."
                searchValue={search}
                onSearch={(v) => {
                    setSearch(v);
                    setPage(1);
                }}
                marginOptions={[
                    { value: 'high', label: 'Margin Tinggi (>20rb)' },
                    { value: 'low', label: 'Margin Rendah (<5rb)' },
                    { value: 'negative', label: 'Margin Negatif' },
                ]}
                marginValue={marginFilter === 'all' ? '' : marginFilter}
                onMarginChange={(v) => {
                    setMarginFilter((v || 'all') as MarginFilter);
                    setPage(1);
                }}
            />

            {paginated.length === 0 ? (
                <EmptyState
                    title={
                        search || marginFilter !== 'all'
                            ? 'Produk tidak ditemukan.'
                            : 'Belum ada produk aktif.'
                    }
                />
            ) : (
                <OwnerTable minWidth="700px">
                    <Table>
                        <TableHeader>
                            <tr className="border-b border-border bg-surface-muted/50 text-left">
                                <TableHead
                                    className="cursor-pointer px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase select-none"
                                    onClick={() => toggleSort('name')}
                                >
                                    Produk
                                    <SortMarker
                                        col="name"
                                        activeCol={sortKey}
                                        direction={sortDir}
                                    />
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase select-none"
                                    onClick={() => toggleSort('center_price')}
                                >
                                    HPP
                                    <SortMarker
                                        col="center_price"
                                        activeCol={sortKey}
                                        direction={sortDir}
                                    />
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase select-none"
                                    onClick={() => toggleSort('selling_price')}
                                >
                                    Harga Jual
                                    <SortMarker
                                        col="selling_price"
                                        activeCol={sortKey}
                                        direction={sortDir}
                                    />
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase select-none"
                                    onClick={() => toggleSort('margin')}
                                >
                                    Margin
                                    <SortMarker
                                        col="margin"
                                        activeCol={sortKey}
                                        direction={sortDir}
                                    />
                                </TableHead>
                                <TableHead className="w-24 px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-text-muted uppercase">
                                    Aksi
                                </TableHead>
                            </tr>
                        </TableHeader>
                        <TableBody>
                            {paginated.map((v) => (
                                <TableRow
                                    key={v.product_id}
                                    className="hover:bg-mint-wash/30 transition-colors"
                                >
                                    <TableCell className="px-3 py-3">
                                        <div className="font-semibold text-text">
                                            {v.category_name
                                                ? `${v.category_name} - ${v.name}`
                                                : v.name}
                                        </div>
                                        {(v.flavor || v.size || v.sku) && (
                                            <div className="mt-0.5 text-xs text-text-muted">
                                                {[v.flavor, v.size, v.sku]
                                                    .filter(Boolean)
                                                    .join(' • ')}
                                            </div>
                                        )}
                                        {v.outlet_override_count > 0 && (
                                            <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-600">
                                                {v.outlet_override_count}{' '}
                                                override
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="px-3 py-3 text-right text-text-muted tabular-nums">
                                        {formatCurrency(v.center_price)}
                                    </TableCell>
                                    <TableCell className="px-3 py-3 text-right text-base font-bold text-text tabular-nums">
                                        {formatCurrency(v.selling_price)}
                                    </TableCell>
                                    <TableCell className="px-3 py-3 text-right">
                                        <MarginBarInline
                                            margin={v.margin}
                                            maxMargin={maxMargin}
                                            sellingPrice={v.selling_price}
                                        />
                                    </TableCell>
                                    <TableCell className="px-3 py-3 text-center">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setSelectedProduct(v);
                                                setModalOpen(true);
                                            }}
                                            className="text-primary"
                                        >
                                            Ubah
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </OwnerTable>
            )}

            {totalPages > 1 && (
                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    total={sorted.length}
                    onPageChange={setPage}
                />
            )}

            {selectedProduct && (
                <GlobalPriceModal
                    open={modalOpen}
                    product={selectedProduct}
                    variant={selectedProduct}
                    onClose={() => {
                        setModalOpen(false);
                        setSelectedProduct(null);
                    }}
                />
            )}
        </div>
    );
}
