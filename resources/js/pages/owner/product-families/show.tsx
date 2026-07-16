import { router, useForm } from '@inertiajs/react';
import {
    Copy,
    Package,
    Pencil,
    Plus,
    Trash2,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { MarginBarInline } from '@/components/owner';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
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
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';
import VariantForm, { DEFAULT_MARKUP_PERCENT } from './variant-form';

// ── Types ──
interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    sku: string | null;
    center_price: number;
    selling_price: number;
    center_stock: number;
    is_active: boolean;
    image: string | null;
    order_items_count: number;
}

interface Family {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    image: string | null;
    is_active: boolean;
    variants: Variant[];
}

// ── Constants ──
type SortKey =
    | 'name'
    | 'center_price'
    | 'selling_price'
    | 'margin'
    | 'center_stock';
type VariantFilter = 'all' | 'active' | 'inactive' | 'low_margin';

const FILTERS: { key: VariantFilter; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Aktif' },
    { key: 'inactive', label: 'Nonaktif' },
    { key: 'low_margin', label: '⚠️ Margin Rendah' },
];

// ── Helpers ──
interface Props {
    family: Family;
}

const margin = (v: Variant) => v.selling_price - v.center_price;

function sortVariants(
    variants: Variant[],
    key: SortKey,
    dir: 'asc' | 'desc',
): Variant[] {
    return [...variants].sort((a, b) => {
        let av: string | number, bv: string | number;

        switch (key) {
            case 'name':
                av = a.name;
                bv = b.name;
                break;
            case 'center_price':
                av = a.center_price;
                bv = b.center_price;
                break;
            case 'selling_price':
                av = a.selling_price;
                bv = b.selling_price;
                break;
            case 'margin':
                av = margin(a);
                bv = margin(b);
                break;
            case 'center_stock':
                av = a.center_stock;
                bv = b.center_stock;
                break;
        }

        const cmp =
            typeof av === 'string'
                ? av.localeCompare(String(bv))
                : Number(av) - Number(bv);

        return dir === 'asc' ? cmp : -cmp;
    });
}

// ── Component ──
export default function ProductFamilyShow({ family }: Props) {
    // Search + modal states
    const [search, setSearch] = useState('');
    const [showVariantForm, setShowVariantForm] = useState(false);
    const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
    const [showFamilyEdit, setShowFamilyEdit] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteFamilyDialog, setDeleteFamilyDialog] = useState(false);

    // Sort + Filter
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [variantFilter, setVariantFilter] = useState<VariantFilter>('all');

    // Bulk edit
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const bulkForm = useForm({
        center_price: '',
        selling_price: '',
        center_stock: '',
        is_active: '' as '' | '1' | '0',
    });

    // Forms
    const familyForm = useForm({
        name: family.name,
        brand: family.brand ?? '',
        description: family.description ?? '',
    });
    const variantForm = useForm({
        name: '',
        flavor: '',
        size: '',
        sku: '',
        center_price: '',
        selling_price: '',
        center_stock: '',
        is_active: true,
    });

    // ── Computed ──
    const filtered = useMemo(() => {
        let list = family.variants;

        if (search) {
            const q = search.toLowerCase();
            list = list.filter(
                (v) =>
                    v.name.toLowerCase().includes(q) ||
                    (v.sku?.toLowerCase().includes(q) ?? false) ||
                    (v.flavor?.toLowerCase().includes(q) ?? false) ||
                    (v.size?.toLowerCase().includes(q) ?? false),
            );
        }

        switch (variantFilter) {
            case 'active':
                list = list.filter((v) => v.is_active);
                break;
            case 'inactive':
                list = list.filter((v) => !v.is_active);
                break;
            case 'low_margin':
                list = list.filter((v) => margin(v) >= 0 && margin(v) < 5000);
                break;
        }

        return list;
    }, [family.variants, search, variantFilter]);

    const sorted = useMemo(
        () => sortVariants(filtered, sortKey, sortDir),
        [filtered, sortKey, sortDir],
    );

    const maxMargin = useMemo(
        () => Math.max(...sorted.map((v) => margin(v)), 1),
        [sorted],
    );

    // ── Handlers ──
    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === sorted.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(sorted.map((v) => v.id)));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const cancelForm = useCallback(() => {
        setShowVariantForm(false);
        setEditingVariant(null);
        variantForm.reset();
    }, [variantForm]);

    const handleUpdateFamily = (e: React.FormEvent) => {
        e.preventDefault();
        familyForm.put(`/owner/product-families/${family.id}`, {
            onSuccess: () => {
                setShowFamilyEdit(false);
            },
            onError: (errors) => {
                Object.entries(errors as Record<string, string>).forEach(
                    ([key, value]) =>
                        familyForm.setError(
                            key as keyof typeof familyForm.data,
                            value,
                        ),
                );
            },
        });
    };
    const handleDeleteFamily = () => {
        router.delete(`/owner/product-families/${family.id}`, {
            onSuccess: () => setDeleteFamilyDialog(false),
        });
    };
    const handleDeleteVariant = () => {
        if (deleteId) {
            router.delete(`/owner/variants/${deleteId}`, {
                onSuccess: () => setDeleteId(null),
            });
        }
    };
    const handleCreateVariant = (e: React.FormEvent) => {
        e.preventDefault();
        variantForm.post(`/owner/product-families/${family.id}/variants`, {
            onSuccess: () => {
                variantForm.reset();
                setShowVariantForm(false);
            },
        });
    };
    const handleUpdateVariant = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVariant) return;
        variantForm.put(`/owner/variants/${editingVariant.id}`, {
            onSuccess: () => {
                variantForm.reset();
                setEditingVariant(null);
            },
        });
    };

    const startEdit = (v: Variant) => {
        setEditingVariant(v);
        variantForm.setData({
            name: v.name,
            flavor: v.flavor ?? '',
            size: v.size ?? '',
            sku: v.sku ?? '',
            center_price: String(v.center_price),
            selling_price: String(v.selling_price),
            center_stock: String(v.center_stock),
            is_active: v.is_active,
        });
    };

    const duplicate = (v: Variant) => {
        setEditingVariant(null);
        variantForm.setData({
            name: '',
            flavor: v.flavor ?? '',
            size: v.size ?? '',
            sku: '',
            center_price: String(v.center_price),
            selling_price: String(v.selling_price),
            center_stock: String(v.center_stock),
            is_active: true,
        });
        setShowVariantForm(true);
    };

    const SortMarker = ({ col }: { col: SortKey }) =>
        sortKey === col ? (
            <span className="ml-0.5 text-[10px] text-primary">
                {sortDir === 'asc' ? '▲' : '▼'}
            </span>
        ) : null;

    if (family === undefined || family === null) {
        return (
            <OwnerPageShell title="Product Family" subtitle="Memuat...">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell
            title={family.name}
            subtitle={family.brand ?? undefined}
            backHref="/owner/product-families"
            headerRight={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setShowFamilyEdit(true)}
                    >
                        <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                        Edit
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => setDeleteFamilyDialog(true)}
                    >
                        <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                        Hapus
                    </Button>
                </div>
            }
        >
            {family.description && (
                <div className="mb-4 rounded-xl bg-surface p-4 shadow-card">
                    <p className="text-sm text-slate-600">
                        {family.description}
                    </p>
                </div>
            )}

            <OwnerFilterCard
                searchPlaceholder="Cari variant..."
                searchValue={search}
                onSearch={setSearch}
                tambahLabel="Tambah Variant"
                tambahOnClick={() => {
                    cancelForm();
                    setShowVariantForm(true);
                }}
            />

            {/* Filter Pills */}
            <div
                className="mb-4 flex flex-wrap items-center gap-2"
                role="group"
            >
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => setVariantFilter(f.key)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${variantFilter === f.key ? 'bg-emerald-50 text-emerald-600 ring-emerald-200' : 'hover:bg-mint-wash bg-surface text-text-muted ring-border'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Empty State */}
            {sorted.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-slate-400" />}
                    title={
                        family.variants.length === 0
                            ? 'Belum ada variant'
                            : 'Tidak ditemukan'
                    }
                    description={
                        family.variants.length === 0
                            ? 'Tambah variant pertama'
                            : 'Coba kata kunci lain'
                    }
                    action={
                        family.variants.length === 0
                            ? {
                                  label: 'Tambah Variant',
                                  onClick: () => setShowVariantForm(true),
                              }
                            : undefined
                    }
                />
            ) : (
                <>
                    {/* Bulk Edit Bar */}
                    {selectedIds.size > 0 && (
                        <div className="mb-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
                            <span className="text-sm font-medium text-blue-700">
                                {selectedIds.size} dipilih
                            </span>
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => setBulkModalOpen(true)}
                            >
                                Edit Massal
                            </Button>
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={() => setSelectedIds(new Set())}
                            >
                                Batal
                            </Button>
                        </div>
                    )}

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl bg-surface shadow-card">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-surface-muted/50 text-left">
                                    <th className="w-8 px-3 py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={
                                                selectedIds.size ===
                                                    sorted.length &&
                                                sorted.length > 0
                                            }
                                            onChange={toggleSelectAll}
                                            className="h-3.5 w-3.5 rounded border-zinc-300 accent-primary"
                                        />
                                    </th>
                                    <th
                                        className="cursor-pointer px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase select-none"
                                        onClick={() => toggleSort('name')}
                                    >
                                        Nama
                                        <SortMarker col="name" />
                                    </th>
                                    <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-text-muted uppercase">
                                        Gambar
                                    </th>
                                    <th
                                        className="cursor-pointer px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase select-none"
                                        onClick={() =>
                                            toggleSort('center_price')
                                        }
                                    >
                                        HPP
                                        <SortMarker col="center_price" />
                                    </th>
                                    <th
                                        className="cursor-pointer px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase select-none"
                                        onClick={() =>
                                            toggleSort('selling_price')
                                        }
                                    >
                                        Harga Jual
                                        <SortMarker col="selling_price" />
                                    </th>
                                    <th
                                        className="cursor-pointer px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase select-none"
                                        onClick={() => toggleSort('margin')}
                                    >
                                        Margin
                                        <SortMarker col="margin" />
                                    </th>
                                    <th
                                        className="cursor-pointer px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase select-none"
                                        onClick={() =>
                                            toggleSort('center_stock')
                                        }
                                    >
                                        Stok
                                        <SortMarker col="center_stock" />
                                    </th>
                                    <th className="w-28 px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-text-muted uppercase">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {sorted.map((v) => {
                                    const m = margin(v);
                                    const isSelected = selectedIds.has(v.id);

                                    return (
                                        <tr
                                            key={v.id}
                                            className={`hover:bg-mint-wash/30 transition-colors ${!v.is_active ? 'opacity-50' : ''} ${isSelected ? 'bg-blue-50/50' : ''}`}
                                        >
                                            <td className="px-3 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() =>
                                                        toggleSelect(v.id)
                                                    }
                                                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-primary"
                                                />
                                            </td>
                                            <td className="px-3 py-3">
                                                {v.image || family.image ? (
                                                    <img
                                                        src={
                                                            (v.image ??
                                                            family.image)
                                                                ? `/storage/${v.image ?? family.image}`
                                                                : undefined
                                                        }
                                                        alt={v.name}
                                                        className="h-8 w-8 rounded object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-xs text-text-muted">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="font-semibold text-text">
                                                    {v.name}
                                                </div>
                                                <div className="mt-0.5 flex items-center gap-1.5">
                                                    {v.sku && (
                                                        <span className="text-xs text-text-subtle">
                                                            {v.sku}
                                                        </span>
                                                    )}
                                                    {!v.is_active && (
                                                        <StatusBadge
                                                            variant="neutral"
                                                            size="sm"
                                                        >
                                                            Nonaktif
                                                        </StatusBadge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-right text-text-muted tabular-nums">
                                                {formatCurrency(v.center_price)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-base font-bold text-text tabular-nums">
                                                {formatCurrency(
                                                    v.selling_price,
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <MarginBarInline
                                                    margin={m}
                                                    maxMargin={maxMargin}
                                                    sellingPrice={
                                                        v.selling_price
                                                    }
                                                />
                                            </td>
                                            <td className="px-3 py-3 text-right text-sm text-text tabular-nums">
                                                {v.center_stock}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            duplicate(v)
                                                        }
                                                        title="Duplikat"
                                                        className="hover:bg-mint-wash rounded p-1 text-text-subtle hover:text-text"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            router.patch(
                                                                `/owner/variants/${v.id}/toggle`,
                                                                {},
                                                                {
                                                                    preserveScroll: true,
                                                                },
                                                            )
                                                        }
                                                        title={
                                                            v.is_active
                                                                ? 'Nonaktifkan'
                                                                : 'Aktifkan'
                                                        }
                                                        className="hover:bg-mint-wash rounded p-1 text-text-subtle hover:text-text"
                                                    >
                                                        {v.is_active ? (
                                                            <ToggleRight className="h-3.5 w-3.5 text-primary" />
                                                        ) : (
                                                            <ToggleLeft className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            startEdit(v)
                                                        }
                                                        title="Edit"
                                                        className="hover:bg-mint-wash rounded p-1 text-text-subtle hover:text-text"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setDeleteId(v.id)
                                                        }
                                                        title="Hapus"
                                                        className="rounded p-1 text-text-subtle hover:bg-red-50 hover:text-red-600"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ── Modals ── */}
            <Dialog open={showFamilyEdit} onOpenChange={setShowFamilyEdit}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Product Family</DialogTitle>
                        <DialogDescription>
                            Perbarui data product family.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateFamily}>
                        <div className="space-y-3">
                            <Input
                                label="Nama"
                                type="text"
                                value={familyForm.data.name}
                                onChange={(e) =>
                                    familyForm.setData('name', e.target.value)
                                }
                                required
                                error={familyForm.errors.name}
                            />
                            <Input
                                label="Brand"
                                type="text"
                                value={familyForm.data.brand}
                                onChange={(e) =>
                                    familyForm.setData('brand', e.target.value)
                                }
                            />
                            <Textarea
                                label="Deskripsi"
                                value={familyForm.data.description}
                                onChange={(e) =>
                                    familyForm.setData(
                                        'description',
                                        e.target.value,
                                    )
                                }
                                rows={2}
                            />
                        </div>
                    </form>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowFamilyEdit(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleUpdateFamily}
                            disabled={familyForm.processing}
                        >
                            Update
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showVariantForm || editingVariant !== null}
                onOpenChange={(open) => {
                    if (!open) cancelForm();
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <VariantForm
                        form={variantForm}
                        editing={!!editingVariant}
                        onSubmit={
                            editingVariant
                                ? handleUpdateVariant
                                : handleCreateVariant
                        }
                        onCancel={cancelForm}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Edit Massal ({selectedIds.size} variant)
                        </DialogTitle>
                        <DialogDescription>
                            Hanya field yang diisi yang akan diperbarui.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const payload: { variant_ids: number[] } & Record<
                                string,
                                string | number | boolean
                            > = { variant_ids: [...selectedIds] } as {
                                variant_ids: number[];
                            } & Record<string, string | number | boolean>;
                            if (bulkForm.data.center_price)
                                payload.center_price = Number(
                                    bulkForm.data.center_price,
                                );
                            if (bulkForm.data.selling_price)
                                payload.selling_price = Number(
                                    bulkForm.data.selling_price,
                                );
                            if (bulkForm.data.center_stock)
                                payload.center_stock = Number(
                                    bulkForm.data.center_stock,
                                );
                            if (bulkForm.data.is_active !== '')
                                payload.is_active =
                                    bulkForm.data.is_active === '1';
                            bulkForm.post(
                                `/owner/product-families/${family.id}/variants/bulk-update`,
                                {
                                    onSuccess: () => {
                                        bulkForm.reset();
                                        setBulkModalOpen(false);
                                        setSelectedIds(new Set());
                                    },
                                },
                            );
                        }}
                    >
                        <div className="space-y-3">
                            <Input
                                label="HPP (Rp)"
                                type="number"
                                value={bulkForm.data.center_price}
                                onChange={(e) =>
                                    bulkForm.setData(
                                        'center_price',
                                        e.target.value,
                                    )
                                }
                                placeholder="Kosongkan jika tidak diubah"
                            />
                            <Input
                                label="Harga Jual (Rp)"
                                type="number"
                                value={bulkForm.data.selling_price}
                                onChange={(e) =>
                                    bulkForm.setData(
                                        'selling_price',
                                        e.target.value,
                                    )
                                }
                                placeholder="Kosongkan jika tidak diubah"
                            />
                            <Input
                                label="Stok"
                                type="number"
                                value={bulkForm.data.center_stock}
                                onChange={(e) =>
                                    bulkForm.setData(
                                        'center_stock',
                                        e.target.value,
                                    )
                                }
                                placeholder="Kosongkan jika tidak diubah"
                            />
                            <select
                                value={bulkForm.data.is_active}
                                onChange={(e) =>
                                    bulkForm.setData(
                                        'is_active',
                                        e.target.value as '' | '1' | '0',
                                    )
                                }
                                className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs"
                            >
                                <option value="">Status (tidak diubah)</option>
                                <option value="1">Aktifkan</option>
                                <option value="0">Nonaktifkan</option>
                            </select>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setBulkModalOpen(false);
                                    bulkForm.reset();
                                }}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={bulkForm.processing}
                            >
                                {bulkForm.processing
                                    ? 'Menyimpan...'
                                    : 'Simpan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleteId !== null}
                onOpenChange={() => setDeleteId(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Variant</DialogTitle>
                        <DialogDescription>
                            Yakin ingin menghapus variant ini?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteId(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteVariant}
                        >
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleteFamilyDialog}
                onOpenChange={() => setDeleteFamilyDialog(false)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Product Family</DialogTitle>
                        <DialogDescription>
                            Semua variant juga akan dihapus.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteFamilyDialog(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteFamily}
                        >
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
