import { router, useForm } from '@inertiajs/react';
import { Copy, Package, Pencil, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { MarginBarInline } from '@/components/owner';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';
import VariantForm, { DEFAULT_MARKUP_PERCENT } from './variant-form';

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
    order_items_count: number;
}

interface Family {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    is_active: boolean;
    variants: Variant[];
}

interface Props {
    family: Family;
}

// ── Sort ──
type VariantSortKey = 'name' | 'center_price' | 'selling_price' | 'margin' | 'center_stock';
const sortableColumns: { key: VariantSortKey; label: string }[] = [
    { key: 'name', label: 'Nama' },
    { key: 'center_price', label: 'HPP' },
    { key: 'selling_price', label: 'Harga Jual' },
    { key: 'margin', label: 'Margin' },
    { key: 'center_stock', label: 'Stok' },
];

// ── Filter ──
type VariantFilter = 'all' | 'active' | 'inactive' | 'low_margin';
const filterOptions: { key: VariantFilter; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Aktif' },
    { key: 'inactive', label: 'Nonaktif' },
    { key: 'low_margin', label: '⚠️ Margin Rendah' },
];

export default function ProductFamilyShow({ family }: Props) {
    const [search, setSearch] = useState('');
    const [showVariantForm, setShowVariantForm] = useState(false);
    const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
    const [showFamilyEdit, setShowFamilyEdit] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteFamilyDialog, setDeleteFamilyDialog] = useState(false);

    // ── Sort & Filter ──
    const [sortKey, setSortKey] = useState<VariantSortKey>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [variantFilter, setVariantFilter] = useState<VariantFilter>('all');

    const toggleSort = useCallback((key: VariantSortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    }, [sortKey]);

    // ── Bulk Select ──
    const [selectedVariantIds, setSelectedVariantIds] = useState<Set<number>>(new Set());

    const toggleSelect = useCallback((id: number) => {
        setSelectedVariantIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedVariantIds(new Set(sorted.map((v) => v.id)));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedVariantIds(new Set());
    }, []);

    // ── Bulk Edit Form ──
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const bulkForm = useForm({
        center_price: '',
        selling_price: '',
        center_stock: '',
        is_active: '' as '' | '1' | '0',
    });

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

    useEffect(() => {
        if (editingVariant) {
            return;
        }

        const parts = [variantForm.data.flavor, variantForm.data.size].filter(Boolean);

        if (parts.length > 0) {
            variantForm.setData('name', parts.join(' '));
        }
    }, [variantForm.data.flavor, variantForm.data.size, editingVariant]);

    useEffect(() => {
        if (editingVariant) {
            return;
        }

        const prefix = family.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
        const flavorCode = variantForm.data.flavor ? variantForm.data.flavor.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') : '';
        const sizeCode = variantForm.data.size ? variantForm.data.size.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
        const parts = [prefix, flavorCode, sizeCode].filter(Boolean);

        if (parts.length > 0) {
            variantForm.setData('sku', parts.join('-'));
        }
    }, [variantForm.data.flavor, variantForm.data.size, family.name, editingVariant]);

    useEffect(() => {
        if (editingVariant) {
            return;
        }

        const center = parseFloat(variantForm.data.center_price);

        if (!isNaN(center) && center > 0) {
            const markup = Math.round(center * (1 + DEFAULT_MARKUP_PERCENT / 100));
            const rounded = Math.ceil(markup / 500) * 500;
            variantForm.setData('selling_price', String(rounded));
        }
    }, [variantForm.data.center_price, editingVariant]);

    // ── Computed ──
    const margin = useCallback((variant: Variant) => {
        return variant.selling_price - variant.center_price;
    }, []);

    const { filtered, sorted } = useMemo(() => {
        const bySearch = family.variants.filter((v) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                v.name.toLowerCase().includes(q) ||
                (v.sku?.toLowerCase().includes(q) ?? false) ||
                (v.flavor?.toLowerCase().includes(q) ?? false) ||
                (v.size?.toLowerCase().includes(q) ?? false)
            );
        });

        const byFilter = bySearch.filter((v) => {
            switch (variantFilter) {
                case 'active': return v.is_active;
                case 'inactive': return !v.is_active;
                case 'low_margin': return (v.selling_price - v.center_price) < 5000 && (v.selling_price - v.center_price) >= 0;
                default: return true;
            }
        });

        const sorted2 = [...byFilter].sort((a, b) => {
            let aVal: string | number, bVal: string | number;

            switch (sortKey) {
                case 'name':
                    aVal = a.name;
                    bVal = b.name;
                    break;
                case 'center_price':
                    aVal = a.center_price;
                    bVal = b.center_price;
                    break;
                case 'selling_price':
                    aVal = a.selling_price;
                    bVal = b.selling_price;
                    break;
                case 'margin':
                    aVal = a.selling_price - a.center_price;
                    bVal = b.selling_price - b.center_price;
                    break;
                case 'center_stock':
                    aVal = a.center_stock;
                    bVal = b.center_stock;
                    break;
                default:
                    aVal = a.name;
                    bVal = b.name;
            }

            const cmp = typeof aVal === 'string' ? aVal.localeCompare(String(bVal)) : Number(aVal) - Number(bVal);

            return sortDir === 'asc' ? cmp : -cmp;
        });

        return { filtered: byFilter, sorted: sorted2 };
    }, [family.variants, search, variantFilter, sortKey, sortDir]);

    const maxMargin = useMemo(() => {
        return Math.max(...sorted.map((v) => v.selling_price - v.center_price), 1);
    }, [sorted]);

    const handleUpdateFamily = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        familyForm.put(`/owner/product-families/${family.id}`, {
            onSuccess: () => {
                setShowFamilyEdit(false);
            },
        });
    }, [family.id, familyForm]);

    const handleCreateVariant = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        variantForm.post(`/owner/product-families/${family.id}/variants`, {
            onSuccess: () => {
                variantForm.reset();
                setShowVariantForm(false);
            },
        });
    }, [family.id, variantForm]);

    const handleUpdateVariant = useCallback((e: React.FormEvent) => {
        e.preventDefault();

        if (!editingVariant) {
            return;
        }

        variantForm.put(`/owner/variants/${editingVariant.id}`, {
            onSuccess: () => {
                variantForm.reset();
                setEditingVariant(null);
            },
        });
    }, [editingVariant, variantForm]);

    const handleDeleteVariant = useCallback(() => {
        if (deleteId) {
            router.delete(`/owner/variants/${deleteId}`, {
                onSuccess: () => setDeleteId(null),
            });
        }
    }, [deleteId]);

    const handleDeleteFamily = useCallback(() => {
        router.delete(`/owner/product-families/${family.id}`, {
            onSuccess: () => setDeleteFamilyDialog(false),
        });
    }, [family.id]);

    const handleToggleVariant = useCallback((variant: Variant) => {
        router.patch(`/owner/variants/${variant.id}/toggle`, {}, {
            preserveScroll: true,
        });
    }, []);

    const startEditVariant = useCallback((variant: Variant) => {
        setEditingVariant(variant);
        setShowVariantForm(false);
        variantForm.setData({
            name: variant.name,
            flavor: variant.flavor ?? '',
            size: variant.size ?? '',
            sku: variant.sku ?? '',
            center_price: String(variant.center_price),
            selling_price: String(variant.selling_price),
            center_stock: String(variant.center_stock),
            is_active: variant.is_active,
        });
    }, [variantForm]);

    const handleDuplicate = useCallback((variant: Variant) => {
        setEditingVariant(null);
        variantForm.setData({
            name: '',
            flavor: variant.flavor ?? '',
            size: variant.size ?? '',
            sku: '',
            center_price: String(variant.center_price),
            selling_price: String(variant.selling_price),
            center_stock: String(variant.center_stock),
            is_active: true,
        });
        setShowVariantForm(true);
    }, [variantForm]);

    const cancelForm = useCallback(() => {
        setShowVariantForm(false);
        setEditingVariant(null);
        variantForm.reset();
    }, [variantForm]);

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
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Edit
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => setDeleteFamilyDialog(true)}
                    >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Hapus
                    </Button>
                </div>
            }
        >
            {family.description && (
                <div className="mb-4 rounded-lg border border-border bg-white p-4" aria-label="Deskripsi Product Family">
                    <p className="text-sm text-slate-600">{family.description}</p>
                </div>
            )}

            <OwnerFilterCard
                searchPlaceholder="Cari variant..."
                searchValue={search}
                onSearch={setSearch}
                tambahLabel="Tambah Variant"
                tambahOnClick={() => {
                    if (editingVariant) {
                        cancelForm();
                    }

                    setShowVariantForm(true);
                }}
            />

            {/* Filter Pills */}
            <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter variant">
                {filterOptions.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => { setVariantFilter(f.key); clearSelection(); }}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                            variantFilter === f.key
                                ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
                                : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {family.variants.length === 0 && !showVariantForm && (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-slate-400" />}
                    title="Belum ada variant"
                    description="Tambah variant pertama untuk product family ini"
                    action={{
                        label: 'Tambah Variant',
                        onClick: () => setShowVariantForm(true),
                    }}
                />
            )}

            {sorted.length > 0 && (
                <>
                    {/* Bulk Edit Button */}
                    {selectedVariantIds.size > 0 && (
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
                            <span className="text-sm font-medium text-blue-700">{selectedVariantIds.size} variant dipilih</span>
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
                                variant="ghost"
                                size="sm"
                                onClick={clearSelection}
                                className="text-blue-700"
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={selectAll}
                            >
                                Pilih Semua
                            </Button>
                        </div>
                    )}

                    {/* Sort Header */}
                    <div className="mb-2 flex items-center gap-2 px-2">
                        <div className="w-5 shrink-0" />
                        {sortableColumns.map((col) => {
                            const isActive = sortKey === col.key;

                            return (
                                <button
                                    key={col.key}
                                    type="button"
                                    onClick={() => toggleSort(col.key)}
                                    className={`flex flex-1 items-center gap-0.5 text-xs font-medium transition-colors hover:text-text ${isActive ? 'text-text' : 'text-text-subtle'}`}
                                >
                                    {col.label}
                                    {isActive && (
                                        <span className="text-primary">{sortDir === 'asc' ? '▲' : '▼'}</span>
                                    )}
                                </button>
                            );
                        })}
                        <div className="w-20 shrink-0" />
                    </div>

                    {/* Variant Rows */}
                    <div className="space-y-1" aria-label="Daftar Variant">
                        {sorted.map((variant) => {
                            const variantMargin = margin(variant);

                            return (
                                <div
                                    key={variant.id}
                                    className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 transition-all duration-200 ${
                                        variant.is_active ? 'border-border' : 'border-border/50 opacity-60'
                                    }`}
                                >
                                    {/* Checkbox */}
                                    <input
                                        type="checkbox"
                                        checked={selectedVariantIds.has(variant.id)}
                                        onChange={() => toggleSelect(variant.id)}
                                        className="h-4 w-4 shrink-0 rounded border-zinc-300 accent-primary"
                                    />
                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-text truncate">{variant.name}</span>
                                            <StatusBadge variant={variant.is_active ? 'success' : 'neutral'} size="sm">
                                                {variant.is_active ? 'Aktif' : 'Nonaktif'}
                                            </StatusBadge>
                                            {variant.sku && (
                                                <span className="text-xs text-text-subtle">{variant.sku}</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* HPP */}
                                    <div className="flex-1 text-right text-sm tabular-nums text-text-muted">{formatCurrency(variant.center_price)}</div>
                                    {/* Harga Jual */}
                                    <div className="flex-1 text-right text-sm font-semibold tabular-nums text-text">{formatCurrency(variant.selling_price)}</div>
                                    {/* Margin */}
                                    <div className="flex-1 text-right text-sm">
                                        <MarginBarInline margin={variantMargin} maxMargin={maxMargin} sellingPrice={variant.selling_price} />
                                    </div>
                                    {/* Stok */}
                                    <div className="flex-1 text-right text-sm tabular-nums text-text">{variant.center_stock}</div>
                                    {/* Actions */}
                                    <div className="flex w-20 shrink-0 items-center justify-end gap-0.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Duplikat ${variant.name}`}
                                            onClick={() => handleDuplicate(variant)}
                                            title="Duplikat"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={variant.is_active ? `Nonaktifkan ${variant.name}` : `Aktifkan ${variant.name}`}
                                            onClick={() => handleToggleVariant(variant)}
                                            title={variant.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                        >
                                            {variant.is_active ? <ToggleRight className="h-3.5 w-3.5 text-primary" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button variant="ghost" size="icon" aria-label={`Edit ${variant.name}`} onClick={() => startEditVariant(variant)} title="Edit">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" aria-label={`Hapus ${variant.name}`} onClick={() => setDeleteId(variant.id)} title="Hapus">
                                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {(search || variantFilter !== 'all') && sorted.length === 0 && family.variants.length > 0 && (
                <div className="rounded-lg border border-border bg-white p-8 text-center" aria-label="Hasil pencarian variant">
                    <p className="text-sm text-text-muted">Tidak ditemukan variant{search ? ` "${search}"` : ''}</p>
                </div>
            )}

            <Dialog open={showFamilyEdit} onOpenChange={setShowFamilyEdit}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Product Family</DialogTitle>
                        <DialogDescription>Perbarui data product family.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateFamily}>
                        <div className="space-y-3">
                            <Input
                                label="Nama"
                                type="text"
                                value={familyForm.data.name}
                                onChange={(e) => familyForm.setData('name', e.target.value)}
                                required
                                error={familyForm.errors.name}
                            />
                            <Input
                                label="Brand"
                                type="text"
                                value={familyForm.data.brand}
                                onChange={(e) => familyForm.setData('brand', e.target.value)}
                            />
                            <Textarea
                                label="Deskripsi"
                                value={familyForm.data.description}
                                onChange={(e) => familyForm.setData('description', e.target.value)}
                                rows={2}
                            />
                        </div>
                    </form>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowFamilyEdit(false)}>Batal</Button>
                        <Button onClick={handleUpdateFamily} disabled={familyForm.processing}>Update</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showVariantForm || editingVariant !== null} onOpenChange={(open) => {
 if (!open) {
cancelForm();
} 
}}>
                <DialogContent className="sm:max-w-lg">
                    <VariantForm
                        form={variantForm}
                        editing={!!editingVariant}
                        onSubmit={editingVariant ? handleUpdateVariant : handleCreateVariant}
                        onCancel={cancelForm}
                    />
                </DialogContent>
            </Dialog>

            {/* Bulk Edit Modal */}
            <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Massal ({selectedVariantIds.size} variant)</DialogTitle>
                        <DialogDescription>Hanya field yang diisi yang akan diperbarui.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const payload: Record<string, string | number | boolean | number[]> = {
                            variant_ids: [...selectedVariantIds],
                        };

                        if (bulkForm.data.center_price) payload.center_price = Number(bulkForm.data.center_price);
                        if (bulkForm.data.selling_price) payload.selling_price = Number(bulkForm.data.selling_price);
                        if (bulkForm.data.center_stock) payload.center_stock = Number(bulkForm.data.center_stock);
                        if (bulkForm.data.is_active !== '') payload.is_active = bulkForm.data.is_active === '1';

                        bulkForm.post(`/owner/product-families/${family.id}/variants/bulk-update`, {
                            onSuccess: () => {
                                bulkForm.reset();
                                setBulkModalOpen(false);
                                clearSelection();
                            },
                        });
                    }}>
                        <div className="space-y-3">
                            <Input
                                label="HPP (Rp)"
                                type="number"
                                value={bulkForm.data.center_price}
                                onChange={(e) => bulkForm.setData('center_price', e.target.value)}
                                placeholder="Kosongkan jika tidak diubah"
                            />
                            <Input
                                label="Harga Jual (Rp)"
                                type="number"
                                value={bulkForm.data.selling_price}
                                onChange={(e) => bulkForm.setData('selling_price', e.target.value)}
                                placeholder="Kosongkan jika tidak diubah"
                            />
                            <Input
                                label="Stok"
                                type="number"
                                value={bulkForm.data.center_stock}
                                onChange={(e) => bulkForm.setData('center_stock', e.target.value)}
                                placeholder="Kosongkan jika tidak diubah"
                            />
                            <div className="flex items-center gap-2">
                                <select
                                    value={bulkForm.data.is_active}
                                    onChange={(e) => bulkForm.setData('is_active', e.target.value as '' | '1' | '0')}
                                    className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
                                >
                                    <option value="">Status (tidak diubah)</option>
                                    <option value="1">Aktifkan</option>
                                    <option value="0">Nonaktifkan</option>
                                </select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setBulkModalOpen(false); bulkForm.reset(); }}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={bulkForm.processing}>
                                {bulkForm.processing ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Variant</DialogTitle>
                        <DialogDescription>Yakin ingin menghapus variant ini? Tindakan ini tidak dapat dibatalkan.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
                        <Button variant="destructive" onClick={handleDeleteVariant}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteFamilyDialog} onOpenChange={() => setDeleteFamilyDialog(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Product Family</DialogTitle>
                        <DialogDescription>Yakin ingin menghapus product family ini? Semua variant juga akan dihapus. Tindakan ini tidak dapat dibatalkan.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteFamilyDialog(false)}>Batal</Button>
                        <Button variant="destructive" onClick={handleDeleteFamily}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
