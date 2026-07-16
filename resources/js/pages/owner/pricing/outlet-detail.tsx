import { router } from '@inertiajs/react';
import { Copy, Package, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { MarginBarInline } from '@/components/owner';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { SkeletonList } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { marginColor } from '@/lib/pricing-utils';
import { OutletPriceModal } from './pricing-modals';
import { BulkPanel, CopyPanel, PaginationBar } from './pricing-shared';
import type {
    MarginFilter,
    OtherOutlet,
    OutletData,
    OutletPriceRow,
    SortDir,
    SortKey,
} from './types';

export default function OutletDetail({
    outlet,
    prices,
    otherOutlets,
    allOutlets,
}: {
    outlet: { id: number; name: string };
    prices?: OutletPriceRow[];
    otherOutlets?: OtherOutlet[];
    allOutlets?: OutletData[];
}) {
    const [search, setSearch] = useState('');
    const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<OutletPriceRow | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkAmount, setBulkAmount] = useState('');
    const [copyOpen, setCopyOpen] = useState(false);
    const [copySource, setCopySource] = useState('');
    const [saving, setSaving] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTitle, setConfirmTitle] = useState('');
    const [confirmDescription, setConfirmDescription] = useState('');
    const [confirmAction, setConfirmAction] = useState<(() => void) | null>(
        null,
    );

    const showConfirm = (title: string, desc: string, action: () => void) => {
        setConfirmTitle(title);
        setConfirmDescription(desc);
        setConfirmAction(() => action);
        setConfirmOpen(true);
    };

    if (!prices) return <SkeletonList count={5} />;

    // Summary stats
    const customCount = prices.filter((p) => p.has_override).length;
    const avgMargin =
        prices.length > 0
            ? prices.reduce((sum, p) => sum + p.margin, 0) / prices.length
            : 0;
    const negativeCount = prices.filter((p) => p.margin < 0).length;

    const filtered = useMemo(
        () =>
            prices.filter((p) => {
                if (search) {
                    const q = search.toLowerCase();
                    if (
                        !p.name.toLowerCase().includes(q) &&
                        !(p.family_name ?? '').toLowerCase().includes(q)
                    )
                        return false;
                }
                if (marginFilter === 'high' && p.margin <= 20000) return false;
                if (
                    marginFilter === 'low' &&
                    (p.margin < 5000 || p.margin > 20000)
                )
                    return false;
                if (marginFilter === 'negative' && p.margin >= 0) return false;
                return true;
            }),
        [prices, search, marginFilter],
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
        () => Math.max(...sorted.map((r) => r.margin), 1),
        [sorted],
    );

    const handleSave = (newPrice: number) => {
        if (!selectedRow || isNaN(newPrice)) return;
        setSaving(true);
        router.patch(
            `/owner/pricing/outlets/${outlet.id}/variants/${selectedRow.variant_id}`,
            { selling_price: newPrice },
            {
                onFinish: () => {
                    setSaving(false);
                    setModalOpen(false);
                    setSelectedRow(null);
                },
            },
        );
    };

    const handleReset = (variantId: number, name: string) => {
        showConfirm('Reset Harga', `Kembalikan ${name} ke harga pusat?`, () => {
            setSaving(true);
            router.delete(
                `/owner/pricing/outlets/${outlet.id}/variants/${variantId}`,
                { onFinish: () => setSaving(false) },
            );
        });
    };

    const handleBulkUpdate = () => {
        const amount = parseFloat(bulkAmount);
        if (isNaN(amount)) return;
        showConfirm(
            'Atur Massal',
            `${sorted.length} produk akan diperbarui. Lanjutkan?`,
            () => {
                setSaving(true);
                router.post(
                    `/owner/pricing/outlets/${outlet.id}/bulk-update`,
                    { adjustment: amount },
                    {
                        onFinish: () => {
                            setSaving(false);
                            setBulkOpen(false);
                            setBulkAmount('');
                        },
                    },
                );
            },
        );
    };

    const handleCopy = () => {
        if (!copySource) return;
        setSaving(true);
        router.post(
            `/owner/pricing/outlets/${outlet.id}/copy`,
            { source_outlet_id: copySource },
            {
                onFinish: () => {
                    setSaving(false);
                    setCopyOpen(false);
                    setCopySource('');
                },
            },
        );
    };

    const handleOutletChange = (outletId: string) => {
        if (outletId)
            router.reload({
                only: ['outletPrices', 'selectedOutlet'],
                data: { tab: 'outlet', outlet_id: outletId },
            });
    };

    const SortMarker = ({ col }: { col: SortKey }) =>
        sortKey === col ? (
            <span className="ml-0.5 text-[10px] text-primary">
                {sortDir === 'asc' ? '▲' : '▼'}
            </span>
        ) : null;

    return (
        <div>
            {/* Outlet Summary KPIs */}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl bg-surface p-4 shadow-card">
                    <div className="text-[11px] font-medium text-text-muted">
                        Total Produk
                    </div>
                    <div className="mt-1 text-xl font-bold text-text tabular-nums">
                        {prices.length}
                    </div>
                </div>
                <div className="rounded-xl bg-surface p-4 shadow-card">
                    <div className="text-[11px] font-medium text-text-muted">
                        Harga Custom
                    </div>
                    <div className="mt-1 text-xl font-bold text-text tabular-nums">
                        {customCount}
                    </div>
                    <div className="text-[11px] text-blue-600">
                        {customCount > 0
                            ? `${customCount}/${prices.length} produk`
                            : 'Semua standar'}
                    </div>
                </div>
                <div className="rounded-xl bg-surface p-4 shadow-card">
                    <div className="text-[11px] font-medium text-text-muted">
                        Rata-rata Margin
                    </div>
                    <div className="mt-1 text-xl font-bold text-text tabular-nums">
                        {formatCurrency(Math.round(avgMargin))}
                    </div>
                </div>
                <div className="rounded-xl bg-surface p-4 shadow-card">
                    <div className="text-[11px] font-medium text-text-muted">
                        Margin Negatif
                    </div>
                    <div
                        className={`mt-1 text-xl font-bold tabular-nums ${negativeCount > 0 ? 'text-red-600' : 'text-text'}`}
                    >
                        {negativeCount}
                    </div>
                    {negativeCount > 0 && (
                        <div className="text-[11px] text-red-600">
                            Perlu perbaikan
                        </div>
                    )}
                </div>
            </div>

            {/* Filters + Actions */}
            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari produk..."
                searchValue={search}
                onSearch={setSearch}
                marginOptions={[
                    { value: 'high', label: 'Margin Tinggi (>20rb)' },
                    { value: 'low', label: 'Margin Rendah (<5rb)' },
                    { value: 'negative', label: 'Margin Negatif' },
                ]}
                marginValue={marginFilter === 'all' ? '' : marginFilter}
                onMarginChange={(v) =>
                    setMarginFilter((v || 'all') as MarginFilter)
                }
            >
                {allOutlets && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={String(outlet.id)}
                            onChange={(e) => handleOutletChange(e.target.value)}
                            options={allOutlets.map((o) => ({
                                value: String(o.id),
                                label: o.name,
                            }))}
                            className="w-44"
                        />
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={Plus}
                            onClick={() => setBulkOpen(!bulkOpen)}
                            aria-label="Atur semua harga"
                        >
                            {bulkOpen ? 'Tutup' : 'Atur Massal'}
                        </Button>
                        {otherOutlets && otherOutlets.length > 0 && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                icon={Copy}
                                onClick={() => setCopyOpen(!copyOpen)}
                                aria-label="Salin harga dari outlet lain"
                            >
                                {copyOpen ? 'Tutup' : 'Salin Dari'}
                            </Button>
                        )}
                    </div>
                )}
            </OwnerFilterCard>

            {bulkOpen && (
                <BulkPanel
                    amount={bulkAmount}
                    onChange={setBulkAmount}
                    onApply={handleBulkUpdate}
                    onCancel={() => {
                        setBulkOpen(false);
                        setBulkAmount('');
                    }}
                    saving={saving}
                    count={sorted.length}
                />
            )}

            {copyOpen && otherOutlets && (
                <CopyPanel
                    outlets={otherOutlets}
                    source={copySource}
                    onChange={setCopySource}
                    onApply={handleCopy}
                    onCancel={() => {
                        setCopyOpen(false);
                        setCopySource('');
                    }}
                    saving={saving}
                />
            )}

            {paginated.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title={
                        search || marginFilter !== 'all'
                            ? 'Produk tidak ditemukan'
                            : 'Belum ada produk aktif'
                    }
                    description={
                        search || marginFilter !== 'all'
                            ? 'Coba kata kunci atau filter lain'
                            : 'Produk akan muncul di sini'
                    }
                />
            ) : (
                <div className="overflow-x-auto rounded-xl bg-surface shadow-card">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/30 bg-surface-muted/50">
                                <th
                                    className="cursor-pointer px-6 py-3.5 text-[11px] font-semibold tracking-wider text-text-muted uppercase select-none"
                                    onClick={() => toggleSort('name')}
                                >
                                    Produk
                                    <SortMarker col="name" />
                                </th>
                                <th
                                    className="cursor-pointer px-6 py-3.5 text-right text-[11px] font-semibold tracking-wider text-text-muted uppercase select-none"
                                    onClick={() => toggleSort('center_price')}
                                >
                                    HPP
                                    <SortMarker col="center_price" />
                                </th>
                                <th
                                    className="cursor-pointer px-6 py-3.5 text-right text-[11px] font-semibold tracking-wider text-text-muted uppercase select-none"
                                    onClick={() => toggleSort('selling_price')}
                                >
                                    Harga Jual
                                    <SortMarker col="selling_price" />
                                </th>
                                <th
                                    className="cursor-pointer px-6 py-3.5 text-right text-[11px] font-semibold tracking-wider text-text-muted uppercase select-none"
                                    onClick={() => toggleSort('margin')}
                                >
                                    Margin
                                    <SortMarker col="margin" />
                                </th>
                                <th className="px-6 py-3.5 text-center text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {paginated.map((row) => (
                                <tr
                                    key={row.variant_id}
                                    className="hover:bg-mint-wash transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-text">
                                                {row.name}
                                            </span>
                                            {row.has_override ? (
                                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                                                    Custom
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">
                                                    Standar
                                                </span>
                                            )}
                                        </div>
                                        {row.family_name && (
                                            <div className="mt-0.5 text-xs text-text-muted">
                                                {row.family_name}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right text-text-muted tabular-nums">
                                        {formatCurrency(row.center_price)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-base font-bold text-text tabular-nums">
                                        {formatCurrency(row.selling_price)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <MarginBarInline
                                            margin={row.margin}
                                            maxMargin={maxMargin}
                                            sellingPrice={row.selling_price}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-1">
                                            {row.has_override && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleReset(
                                                            row.variant_id,
                                                            row.name,
                                                        )
                                                    }
                                                    title="Reset ke harga pusat"
                                                    className="rounded-lg p-1.5 text-text-subtle transition-colors hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedRow(row);
                                                    setModalOpen(true);
                                                }}
                                                title="Ubah harga"
                                                className="hover:bg-mint-wash rounded-lg p-1.5 text-text-subtle transition-colors hover:text-primary"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    total={sorted.length}
                    onPageChange={setPage}
                />
            )}

            {selectedRow && (
                <OutletPriceModal
                    open={modalOpen}
                    row={selectedRow}
                    onClose={() => {
                        setModalOpen(false);
                        setSelectedRow(null);
                    }}
                    onSave={handleSave}
                    saving={saving}
                />
            )}

            <Dialog
                open={confirmOpen}
                onOpenChange={(isOpen) => !isOpen && setConfirmOpen(false)}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{confirmTitle}</DialogTitle>
                        <DialogDescription>
                            {confirmDescription}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setConfirmOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => {
                                confirmAction?.();
                                setConfirmOpen(false);
                            }}
                        >
                            Lanjutkan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
