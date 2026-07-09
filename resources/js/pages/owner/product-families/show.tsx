import { router, useForm } from '@inertiajs/react';
import { Package, Pencil, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';
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

export default function ProductFamilyShow({ family }: Props) {
    const [search, setSearch] = useState('');
    const [showVariantForm, setShowVariantForm] = useState(false);
    const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
    const [showFamilyEdit, setShowFamilyEdit] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteFamilyDialog, setDeleteFamilyDialog] = useState(false);

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

    const cancelForm = useCallback(() => {
        setShowVariantForm(false);
        setEditingVariant(null);
        variantForm.reset();
    }, [variantForm]);

    const margin = useCallback((variant: Variant) => {
        return variant.selling_price - variant.center_price;
    }, []);

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

            {filteredVariants.length > 0 && (
                <div className="space-y-2" aria-label="Daftar Variant">
                    {filteredVariants.map((variant) => (
                        <div
                            key={variant.id}
                            className={`rounded-lg border bg-white p-4 transition-all duration-200 ${
                                variant.is_active ? 'border-border' : 'border-border/50 opacity-60'
                            }`}
                        >
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
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={variant.is_active ? `Nonaktifkan ${variant.name}` : `Aktifkan ${variant.name}`}
                                        onClick={() => handleToggleVariant(variant)}
                                        title={variant.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                    >
                                        {variant.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label={`Edit ${variant.name}`} onClick={() => startEditVariant(variant)} title="Edit">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label={`Hapus ${variant.name}`} onClick={() => setDeleteId(variant.id)} title="Hapus">
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                    </Button>
                                </div>
                            </div>

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

            {search && filteredVariants.length === 0 && family.variants.length > 0 && (
                <div className="rounded-lg border border-border bg-white p-8 text-center" aria-label="Hasil pencarian variant">
                    <p className="text-sm text-text-muted">Tidak ditemukan variant "{search}"</p>
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
