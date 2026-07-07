import { router, useForm } from '@inertiajs/react';
import { Package, Search, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';

const DEFAULT_MARKUP_PERCENT = 30;

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

export default function ProductFamilyShow({ family }: Props) {
    const [search, setSearch] = useState('');
    const [showVariantForm, setShowVariantForm] = useState(false);
    const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
    const [showFamilyEdit, setShowFamilyEdit] = useState(false);

    // Family edit form
    const familyForm = useForm({
        name: family.name,
        brand: family.brand ?? '',
        description: family.description ?? '',
    });

    // Variant form
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

    // Auto-generate name from flavor + size
    useEffect(() => {
        if (editingVariant) {
return;
} // don't auto-fill when editing

        const parts = [variantForm.data.flavor, variantForm.data.size].filter(Boolean);

        if (parts.length > 0) {
            variantForm.setData('name', parts.join(' '));
        }
    }, [variantForm.data.flavor, variantForm.data.size, editingVariant]);

    // Auto-generate SKU from family name + flavor + size
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

    // Auto-generate selling_price from center_price + markup
    useEffect(() => {
        if (editingVariant) {
return;
}

        const center = parseFloat(variantForm.data.center_price);

        if (!isNaN(center) && center > 0) {
            const markup = Math.round(center * (1 + DEFAULT_MARKUP_PERCENT / 100));
            // Round to nearest 500
            const rounded = Math.ceil(markup / 500) * 500;
            variantForm.setData('selling_price', String(rounded));
        }
    }, [variantForm.data.center_price, editingVariant]);

    const filteredVariants = useMemo(() => {
        if (!search) {
return family.variants;
}

        const q = search.toLowerCase();

        return family.variants.filter((v) =>
            v.name.toLowerCase().includes(q) ||
            (v.sku?.toLowerCase().includes(q) ?? false) ||
            (v.flavor?.toLowerCase().includes(q) ?? false) ||
            (v.size?.toLowerCase().includes(q) ?? false)
        );
    }, [family.variants, search]);

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

    const handleDeleteVariant = useCallback((variantId: number) => {
        if (confirm('Hapus variant ini?')) {
            router.delete(`/owner/variants/${variantId}`);
        }
    }, []);

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

    const cancelForm = useCallback(() => {
        setShowVariantForm(false);
        setEditingVariant(null);
        variantForm.reset();
    }, [variantForm]);

    const margin = useCallback((variant: Variant) => {
        return variant.selling_price - variant.center_price;
    }, []);

    return (
        <OwnerPageShell
            title={family.name}
            subtitle={family.brand ?? undefined}
            backHref="/owner/product-families"
            headerRight={
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFamilyEdit(!showFamilyEdit)}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-slate-700 hover:bg-zinc-50"
                    >
                        <Pencil className="h-4 w-4" />
                        Edit
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Hapus product family ini? Semua variant juga akan dihapus.')) {
                                router.delete(`/owner/product-families/${family.id}`);
                            }
                        }}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="h-4 w-4" />
                        Hapus
                    </button>
                </div>
            }
        >
            {/* Family Edit Form */}
            {showFamilyEdit && (
                <form onSubmit={handleUpdateFamily} className="mb-4 rounded-lg border border-border bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-text">Edit Product Family</h3>
                        <button type="button" onClick={() => setShowFamilyEdit(false)} className="text-text-subtle hover:text-text-muted">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Nama</label>
                            <input
                                type="text"
                                value={familyForm.data.name}
                                onChange={(e) => familyForm.setData('name', e.target.value)}
                                required
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            />
                            {familyForm.errors.name && <p className="mt-1 text-xs text-red-600">{familyForm.errors.name}</p>}
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Brand</label>
                            <input
                                type="text"
                                value={familyForm.data.brand}
                                onChange={(e) => familyForm.setData('brand', e.target.value)}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Deskripsi</label>
                            <textarea
                                value={familyForm.data.description}
                                onChange={(e) => familyForm.setData('description', e.target.value)}
                                rows={2}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={familyForm.processing}
                            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary disabled:opacity-50"
                        >
                            {familyForm.processing ? 'Menyimpan...' : 'Update'}
                        </button>
                    </div>
                </form>
            )}

            {/* Family Info */}
            {family.description && !showFamilyEdit && (
                <div className="mb-4 rounded-lg border border-border bg-white p-4">
                    <p className="text-sm text-slate-600">{family.description}</p>
                </div>
            )}

            {/* Search and Add */}
            <div className="mb-4 flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari variant..."
                        className="w-full bg-transparent py-2 text-sm placeholder:text-slate-400 focus:outline-none"
                    />
                </div>
                <button
                    onClick={() => {
                        if (editingVariant) {
                            cancelForm();
                        }

                        setShowVariantForm(!showVariantForm);
                    }}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-white hover:bg-primary"
                >
                    <Plus className="h-4 w-4" />
                    {showVariantForm ? 'Batal' : 'Tambah Variant'}
                </button>
            </div>

            {/* Variant Form */}
            {(showVariantForm || editingVariant) && (
                <form
                    onSubmit={editingVariant ? handleUpdateVariant : handleCreateVariant}
                    className="mb-4 rounded-lg border border-border bg-white p-4"
                >
                    <h2 className="mb-3 text-sm font-semibold text-text">
                        {editingVariant ? 'Edit Variant' : 'Tambah Variant'}
                    </h2>
                    <div className="space-y-3">
                        {/* Required: Rasa + Ukuran + Harga Center */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-text-muted">Rasa</label>
                                <input
                                    type="text"
                                    value={variantForm.data.flavor}
                                    onChange={(e) => variantForm.setData('flavor', e.target.value)}
                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                                    placeholder="Coklat"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-text-muted">Ukuran</label>
                                <input
                                    type="text"
                                    value={variantForm.data.size}
                                    onChange={(e) => variantForm.setData('size', e.target.value)}
                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                                    placeholder="250ml"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-text-muted">Harga Center (Rp)</label>
                                <input
                                    type="number"
                                    value={variantForm.data.center_price}
                                    onChange={(e) => variantForm.setData('center_price', e.target.value)}
                                    required
                                    min="0"
                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        {/* Auto-generated (editable) */}
                        <div className="rounded-lg bg-surface-muted p-3">
                            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-subtle">Otomatis (bisa diubah)</div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-text-muted">Nama Variant</label>
                                    <input
                                        type="text"
                                        value={variantForm.data.name}
                                        onChange={(e) => variantForm.setData('name', e.target.value)}
                                        required
                                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                                    />
                                    {variantForm.errors.name && <p className="mt-1 text-xs text-red-600">{variantForm.errors.name}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-text-muted">SKU</label>
                                    <input
                                        type="text"
                                        value={variantForm.data.sku}
                                        onChange={(e) => variantForm.setData('sku', e.target.value)}
                                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-text-muted">Harga Jual (Rp) <span className="text-text-subtle">({DEFAULT_MARKUP_PERCENT}% markup)</span></label>
                                    <input
                                        type="number"
                                        value={variantForm.data.selling_price}
                                        onChange={(e) => variantForm.setData('selling_price', e.target.value)}
                                        required
                                        min="0"
                                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-text-muted">Stok Pusat</label>
                                    <input
                                        type="number"
                                        value={variantForm.data.center_stock || '0'}
                                        onChange={(e) => variantForm.setData('center_stock', e.target.value)}
                                        min="0"
                                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {editingVariant && (
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={variantForm.data.is_active}
                                    onChange={(e) => variantForm.setData('is_active', e.target.checked)}
                                    className="rounded border-zinc-300"
                                />
                                <span className="text-sm text-zinc-700">Aktif</span>
                            </label>
                        )}
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={variantForm.processing}
                                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary disabled:opacity-50"
                            >
                                {variantForm.processing ? 'Menyimpan...' : editingVariant ? 'Update' : 'Simpan'}
                            </button>
                            <button
                                type="button"
                                onClick={cancelForm}
                                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-zinc-50"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* Empty State */}
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

            {/* Variants List */}
            {filteredVariants.length > 0 && (
                <div className="space-y-2">
                    {filteredVariants.map((variant) => (
                        <div
                            key={variant.id}
                            className={`rounded-lg border bg-white p-4 transition-all duration-200 ${
                                variant.is_active ? 'border-border' : 'border-border/50 opacity-60'
                            }`}
                        >
                            {/* Row 1: name + badge + sku + actions */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-text">{variant.name}</span>
                                    <StatusBadge variant={variant.is_active ? 'success' : 'neutral'} size="sm">
                                        {variant.is_active ? 'Aktif' : 'Nonaktif'}
                                    </StatusBadge>
                                    {variant.sku && (
                                        <span className="text-xs text-text-subtle">{variant.sku}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-0.5">
                                    <button
                                        onClick={() => handleToggleVariant(variant)}
                                        className={`rounded-lg p-1.5 transition-colors ${
                                            variant.is_active ? 'text-primary hover:bg-primary-light' : 'text-text-subtle hover:bg-surface-muted'
                                        }`}
                                        title={variant.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                    >
                                        {variant.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                    </button>
                                    <button onClick={() => startEditVariant(variant)} className="rounded-lg p-1.5 text-text-subtle hover:bg-surface-muted hover:text-text-muted" title="Edit">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteVariant(variant.id)} className="rounded-lg p-1.5 text-text-subtle hover:bg-red-50 hover:text-red-600" title="Hapus">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Row 2: stats inline */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                                <span className="text-text-muted">{formatCurrency(variant.center_price)}</span>
                                <span className="text-text-subtle">&rarr;</span>
                                <span className="font-semibold text-text">{formatCurrency(variant.selling_price)}</span>
                                <span className="text-text-subtle">&middot;</span>
                                <span className="text-text-muted">{variant.center_stock} pcs</span>
                                <span className="text-text-subtle">&middot;</span>
                                <span className="font-semibold text-emerald-600">{formatCurrency(margin(variant))} margin</span>
                                {variant.order_items_count > 0 && (
                                    <>
                                        <span className="text-text-subtle">&middot;</span>
                                        <span className="text-text-muted">{variant.order_items_count} pesanan</span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Search Empty State */}
            {search && filteredVariants.length === 0 && family.variants.length > 0 && (
                <div className="rounded-lg border border-border bg-white p-8 text-center">
                    <p className="text-sm text-text-muted">Tidak ditemukan variant "{search}"</p>
                </div>
            )}
        </OwnerPageShell>
    );
}
