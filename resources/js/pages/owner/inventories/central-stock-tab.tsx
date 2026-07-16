import { router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import SortableTh from '@/components/owner/sortable-th';
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
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { displayProductName } from '@/lib/display';
import { formatCurrency } from '@/lib/format';

const reasonOptions = [
    { value: 'Stok opname', label: 'Stok Opname' },
    { value: 'Produk rusak', label: 'Produk Rusak' },
    { value: 'Produk expired', label: 'Produk Expired' },
    { value: 'Penerimaan supplier', label: 'Penerimaan Supplier' },
    { value: 'Koreksi manual', label: 'Koreksi Manual' },
];

type SortKey = 'name' | 'center_stock' | 'center_price';
type StockFilter = 'all' | 'empty' | 'low' | 'healthy';

const STOCK_FILTERS: { key: StockFilter; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'empty', label: 'Habis' },
    { key: 'low', label: 'Rendah' },
    { key: 'healthy', label: 'Aman' },
];

export default function CentralStockTab({
    variants,
    stats,
}: {
    variants?: any[];
    stats?: any;
}) {
    const [search, setSearch] = useState('');
    const [editModal, setEditModal] = useState<any>(null);
    const [newStock, setNewStock] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [stockFilter, setStockFilter] = useState<StockFilter>('all');

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    if (!variants || !stats)
        return (
            <div className="h-20 animate-pulse rounded-lg border border-border bg-surface" />
        );

    const filtered = useMemo(() => {
        let list = variants.filter(Boolean);

        if (search) {
            const q = search.toLowerCase();
            list = list.filter(
                (v: any) =>
                    v.name.toLowerCase().includes(q) ||
                    (v.sku ?? '').toLowerCase().includes(q),
            );
        }

        switch (stockFilter) {
            case 'empty':
                list = list.filter((v: any) => v.center_stock <= 0);
                break;
            case 'low':
                list = list.filter(
                    (v: any) => v.center_stock > 0 && v.center_stock <= 10,
                );
                break;
            case 'healthy':
                list = list.filter((v: any) => v.center_stock > 10);
                break;
        }

        return list;
    }, [variants, search, stockFilter]);

    const sorted = useMemo(
        () =>
            [...filtered].sort((a: any, b: any) => {
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

    return (
        <>
            <OwnerKpiStrip
                cols={4}
                items={[
                    { label: 'Total Variant', value: stats.total_variants },
                    { label: 'Total Stok', value: `${stats.total_stock} pcs` },
                    {
                        label: 'Stok Habis',
                        value: stats.zero_stock,
                        sublabel:
                            stats.zero_stock > 0 ? 'Perlu tindakan' : undefined,
                        sublabelColor: 'text-red-500',
                    },
                    {
                        label: 'Stok Rendah',
                        value: stats.low_stock,
                        sublabel:
                            stats.low_stock > 0 ? 'Perlu tindakan' : undefined,
                        sublabelColor: 'text-amber-500',
                    },
                ]}
            />

            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari produk atau SKU..."
                searchValue={search}
                onSearch={(val) => setSearch(val)}
            />

            {/* Stock filter pills */}
            <div
                className="mb-4 flex flex-wrap items-center gap-2"
                role="group"
            >
                {STOCK_FILTERS.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => setStockFilter(f.key)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${stockFilter === f.key ? 'bg-emerald-50 text-emerald-600 ring-emerald-200' : 'hover:bg-mint-wash bg-surface text-text-muted ring-border'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {sorted.length === 0 ? (
                <EmptyState
                    title="Tidak ada produk ditemukan"
                    description="Coba ubah kata kunci pencarian"
                />
            ) : (
                <div className="overflow-x-auto rounded-xl bg-surface shadow-card">
                    <table
                        className="w-full min-w-[600px]"
                        aria-label="Stok Pusat"
                    >
                        <thead>
                            <tr className="bg-surface-muted/50">
                                <SortableTh
                                    label="Produk / SKU"
                                    active={sortKey === 'name'}
                                    dir={sortDir}
                                    onClick={() => toggleSort('name')}
                                />
                                <SortableTh
                                    label="Stok"
                                    active={sortKey === 'center_stock'}
                                    dir={sortDir}
                                    align="right"
                                    onClick={() => toggleSort('center_stock')}
                                />
                                <SortableTh
                                    label="HPP"
                                    active={sortKey === 'center_price'}
                                    dir={sortDir}
                                    align="right"
                                    onClick={() => toggleSort('center_price')}
                                />
                                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
                                    Status
                                </th>
                                <th className="w-20 px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((v: any) => {
                                const isZero = v.center_stock <= 0;
                                const isLow =
                                    v.center_stock > 0 && v.center_stock <= 10;

                                return (
                                    <tr
                                        key={v.id}
                                        className="hover:bg-mint-wash border-t border-border/20 transition-colors"
                                    >
                                        <td className="px-3 py-3">
                                            <span className="font-bold text-text">
                                                {displayProductName(v)}
                                            </span>
                                            {v.sku && (
                                                <span className="ml-1 text-xs text-text-muted">
                                                    {v.sku}
                                                </span>
                                            )}
                                        </td>
                                        <td
                                            className={`px-3 py-3 text-right font-bold tabular-nums ${isZero ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}
                                        >
                                            {v.center_stock} pcs
                                        </td>
                                        <td className="px-3 py-3 text-right text-text-muted tabular-nums">
                                            {formatCurrency(v.center_price)}
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusBadge
                                                variant={
                                                    isZero
                                                        ? 'danger'
                                                        : isLow
                                                          ? 'warning'
                                                          : 'success'
                                                }
                                                size="sm"
                                            >
                                                {isZero
                                                    ? 'Habis'
                                                    : isLow
                                                      ? 'Rendah'
                                                      : 'Aman'}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setEditModal(v);
                                                    setNewStock(
                                                        String(v.center_stock),
                                                    );
                                                    setReason('');
                                                }}
                                            >
                                                Edit
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog
                open={!!editModal}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setEditModal(null);
                }}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Edit Stok Pusat</DialogTitle>
                        <DialogDescription>{editModal?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">
                                Stok Saat Ini
                            </label>
                            <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">
                                {editModal?.center_stock} pcs
                            </div>
                        </div>
                        <Input
                            label="Stok Baru"
                            type="number"
                            value={newStock}
                            onChange={(e) => setNewStock(e.target.value)}
                            min={0}
                            autoFocus
                        />
                        <Select
                            label="Alasan"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            options={reasonOptions}
                            placeholder="Pilih alasan..."
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="secondary"
                            onClick={() => setEditModal(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={() => {
                                if (!editModal) return;
                                setSaving(true);
                                router.patch(
                                    `/owner/inventories/central-stock/${editModal.id}`,
                                    {
                                        center_stock: parseInt(newStock),
                                        reason: reason || undefined,
                                    },
                                    {
                                        onFinish: () => {
                                            setSaving(false);
                                            setEditModal(null);
                                        },
                                    },
                                );
                            }}
                            disabled={
                                saving ||
                                parseInt(newStock) === editModal?.center_stock
                            }
                            loading={saving}
                        >
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
