import { useForm, router } from '@inertiajs/react';
import { X, Plus, Package, Layers, Sparkles, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import ImageUploadField from '@/components/owner/image-upload-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';
import type { Product, ProductCategory } from '@/types/product';

interface ProductFormProps {
    category: ProductCategory;
    editingProduct?: Product | null;
    onSuccess?: (newIds: number[] | number) => void;
    onClose?: () => void;
}

type Mode = 'single' | 'bulk' | 'bulk-size';

export default function ProductForm({
    category,
    editingProduct,
    onSuccess,
    onClose,
}: ProductFormProps) {
    const isEditing = !!editingProduct;
    const [mode, setMode] = useState<Mode>(isEditing ? 'single' : 'single');
    const [singleImageFile, setSingleImageFile] = useState<File | null>(null);
    const [singleImageExisting, setSingleImageExisting] = useState<
        string | null
    >(editingProduct?.display_image ?? null);

    // Single form using Inertia useForm
    const singleForm = useForm({
        name: editingProduct?.name ?? '',
        description: editingProduct?.description ?? '',
        flavor: editingProduct?.flavor ?? '',
        size: editingProduct?.size ?? '',
        sku: editingProduct?.sku ?? '',
        center_price: editingProduct ? String(editingProduct.center_price) : '',
        selling_price: editingProduct
            ? String(editingProduct.selling_price)
            : '',
        image: null as File | null,
        is_active: editingProduct?.is_active ?? true,
        product_category_id: category.id,
    });

    // Bulk form
    const bulkForm = useForm({
        size: '200ml',
        center_price: '30000',
        selling_price: '40000',
        flavors: ['Coffee', 'Chocolate', 'Strawberry', 'Vanilla'] as string[],
        description: '',
    });

    const [flavorInput, setFlavorInput] = useState('');
    const [bulkFlavorsText, setBulkFlavorsText] = useState(''); // alternative textarea input
    const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});

    // Bulk Size state
    const [sharedImageFile, setSharedImageFile] = useState<File | null>(null);
    const [sharedImageExisting, setSharedImageExisting] = useState<
        string | null
    >(null);
    interface BulkSizeRow {
        size: string;
        center_price: string;
        selling_price: string;
        sku: string;
    }
    const [bulkSizeRows, setBulkSizeRows] = useState<BulkSizeRow[]>([
        { size: '', center_price: '', selling_price: '', sku: '' },
    ]);
    const [bulkSizeFlavor, setBulkSizeFlavor] = useState('');
    const [bulkSizeDescription, setBulkSizeDescription] = useState('');
    const [bulkSizeErrors, setBulkSizeErrors] = useState<
        Record<string, string>
    >({});

    // Single margin
    const singleMargin = useMemo(() => {
        const cp = Number(singleForm.data.center_price);
        const sp = Number(singleForm.data.selling_price);

        if (!Number.isFinite(cp) || !Number.isFinite(sp)) {
            return { amount: 0, pct: 0, valid: false };
        }

        if (cp <= 0) {
            return { amount: sp - cp, pct: 0, valid: true };
        }

        return { amount: sp - cp, pct: ((sp - cp) / cp) * 100, valid: true };
    }, [singleForm.data.center_price, singleForm.data.selling_price]);

    // Bulk margin
    const bulkMargin = useMemo(() => {
        const cp = Number(bulkForm.data.center_price);
        const sp = Number(bulkForm.data.selling_price);

        if (!Number.isFinite(cp) || !Number.isFinite(sp)) {
            return { amount: 0, pct: 0, valid: false };
        }

        if (cp <= 0) {
            return { amount: sp - cp, pct: 0, valid: true };
        }

        return { amount: sp - cp, pct: ((sp - cp) / cp) * 100, valid: true };
    }, [bulkForm.data.center_price, bulkForm.data.selling_price]);

    const bulkSizeRowMargins = useMemo(() => {
        return bulkSizeRows.map((row) => {
            const cp = Number(row.center_price);
            const sp = Number(row.selling_price);

            if (!Number.isFinite(cp) || !Number.isFinite(sp) || cp <= 0) {
                return {
                    amount:
                        Number.isFinite(sp) && Number.isFinite(cp)
                            ? sp - cp
                            : 0,
                    pct: 0,
                    valid: Number.isFinite(cp) && Number.isFinite(sp),
                };
            }

            return {
                amount: sp - cp,
                pct: ((sp - cp) / cp) * 100,
                valid: true,
            };
        });
    }, [bulkSizeRows]);

    const addBulkSizeRow = () => {
        setBulkSizeRows((prev) => [
            ...prev,
            { size: '', center_price: '', selling_price: '', sku: '' },
        ]);
    };

    const removeBulkSizeRow = (index: number) => {
        setBulkSizeRows((prev) => prev.filter((_, i) => i !== index));
    };

    const updateBulkSizeRow = (
        index: number,
        field: keyof BulkSizeRow,
        value: string,
    ) => {
        setBulkSizeRows((prev) =>
            prev.map((row, i) =>
                i === index ? { ...row, [field]: value } : row,
            ),
        );
    };

    const autoSku = (size: string) => {
        if (!size) {
            return '';
        }

        const s = size.replace(/\s+/g, '').toUpperCase();

        return `${s}-${(bulkSizeFlavor || 'GEN').slice(0, 3).toUpperCase()}-XXXX`;
    };

    const parsedFlavors = useMemo(() => {
        // merge chip list + textarea comma separated if bulkFlavorsText provided
        const fromChips = bulkForm.data.flavors;
        const fromText = bulkFlavorsText
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
        // deduplicate case-insensitive, keep first occurrence
        const combined = [...fromChips, ...fromText];
        const seen = new Set<string>();
        const dedup: string[] = [];

        for (const f of combined) {
            const key = f.toLowerCase();

            if (!seen.has(key)) {
                seen.add(key);
                dedup.push(f);
            }
        }

        return dedup;
    }, [bulkForm.data.flavors, bulkFlavorsText]);

    const addFlavorChip = () => {
        const val = flavorInput.trim();

        if (!val) {
            return;
        }

        const parts = val
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
        const newFlavors = [...bulkForm.data.flavors];

        for (const p of parts) {
            if (!newFlavors.some((f) => f.toLowerCase() === p.toLowerCase())) {
                newFlavors.push(p);
            }
        }

        bulkForm.setData('flavors', newFlavors);
        setFlavorInput('');
    };

    const removeFlavorChip = (flavor: string) => {
        bulkForm.setData(
            'flavors',
            bulkForm.data.flavors.filter((f) => f !== flavor),
        );
    };

    const handleFlavorInputKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addFlavorChip();
        }
    };

    const generateSkuHint = (flavor: string, size: string) => {
        const f = (flavor || 'GEN').slice(0, 3).toUpperCase();
        const s = (size || '').replace(/\s+/g, '').toUpperCase() || 'STD';

        return `${f}-${s}-XXXX`;
    };

    const handleSingleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // client validation
        if (
            Number(singleForm.data.selling_price) <
            Number(singleForm.data.center_price)
        ) {
            singleForm.setError('selling_price', 'Harga jual harus >= HPP');

            return;
        }

        if (isEditing && editingProduct) {
            const fd = new FormData();
            fd.append('name', singleForm.data.name);

            if (singleForm.data.description) {
                fd.append('description', singleForm.data.description);
            }

            if (singleForm.data.flavor) {
                fd.append('flavor', singleForm.data.flavor);
            }

            if (singleForm.data.size) {
                fd.append('size', singleForm.data.size);
            }

            if (singleForm.data.sku) {
                fd.append('sku', singleForm.data.sku);
            }

            fd.append('center_price', singleForm.data.center_price);
            fd.append('selling_price', singleForm.data.selling_price);
            fd.append('is_active', singleForm.data.is_active ? '1' : '0');

            if (singleImageFile) {
                fd.append('image', singleImageFile);
            }

            fd.append('_method', 'PUT');

            router.post(`/owner/products/${editingProduct.id}`, fd, {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    onSuccess?.([editingProduct.id]);
                    onClose?.();
                },
                onError: (errors) => {
                    // map to useForm errors for display
                    Object.entries(errors).forEach(([k, v]) => {
                        singleForm.setError(k as any, v as string);
                    });
                },
            });
        } else {
            const fd = new FormData();
            fd.append('name', singleForm.data.name);

            if (singleForm.data.description) {
                fd.append('description', singleForm.data.description);
            }

            if (singleForm.data.flavor) {
                fd.append('flavor', singleForm.data.flavor);
            }

            if (singleForm.data.size) {
                fd.append('size', singleForm.data.size);
            }

            if (singleForm.data.sku) {
                fd.append('sku', singleForm.data.sku);
            }

            fd.append('center_price', singleForm.data.center_price);
            fd.append('selling_price', singleForm.data.selling_price);
            fd.append('is_active', singleForm.data.is_active ? '1' : '0');
            fd.append('product_category_id', String(category.id));

            if (singleImageFile) {
                fd.append('image', singleImageFile);
            }

            router.post(
                `/owner/product-categories/${category.id}/products`,
                fd,
                {
                    forceFormData: true,
                    preserveScroll: true,
                    onSuccess: (page: any) => {
                        const flash = page?.props?.flash ?? {};
                        const newId = flash.new_product_id;
                        const newIds = flash.new_product_ids;

                        if (newIds && Array.isArray(newIds)) {
                            onSuccess?.(newIds);
                        } else if (newId) {
                            onSuccess?.([newId]);
                        } else {
                            onSuccess?.([]);
                        }

                        onClose?.();
                        singleForm.reset();
                        setSingleImageFile(null);
                        setSingleImageExisting(null);
                    },
                    onError: (errors) => {
                        Object.entries(errors).forEach(([k, v]) => {
                            singleForm.setError(k as any, v as string);
                        });
                    },
                },
            );
        }
    };

    const handleBulkSizeSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!bulkSizeFlavor.trim()) {
            setBulkSizeErrors({ flavor: 'Flavor wajib diisi' });

            return;
        }

        if (bulkSizeRows.length === 0) {
            setBulkSizeErrors({ rows: 'Minimal 1 ukuran' });

            return;
        }

        const errs: Record<string, string> = {};

        for (let i = 0; i < bulkSizeRows.length; i++) {
            const row = bulkSizeRows[i];

            if (!row.size.trim()) {
                errs[`row_${i}_size`] = `Ukuran baris ${i + 1} wajib`;
            }

            if (!row.center_price || Number(row.center_price) < 0) {
                errs[`row_${i}_center_price`] = `HPP baris ${i + 1} wajib`;
            }

            if (!row.selling_price || Number(row.selling_price) < 0) {
                errs[`row_${i}_selling_price`] =
                    `Harga jual baris ${i + 1} wajib`;
            }

            if (Number(row.selling_price) < Number(row.center_price)) {
                errs[`row_${i}_selling_price`] =
                    `Harga jual baris ${i + 1} harus >= HPP`;
            }
        }

        if (Object.keys(errs).length > 0) {
            setBulkSizeErrors(errs);

            return;
        }

        setBulkSizeErrors({});

        const fd = new FormData();

        if (sharedImageFile) {
            fd.append('image', sharedImageFile);
        }

        fd.append('flavor', bulkSizeFlavor.trim());

        if (bulkSizeDescription.trim()) {
            fd.append('description', bulkSizeDescription.trim());
        }

        fd.append(
            'sizes',
            JSON.stringify(
                bulkSizeRows.map((s) => ({
                    size: s.size.trim(),
                    center_price: Number(s.center_price),
                    selling_price: Number(s.selling_price),
                    sku: s.sku.trim() || null,
                })),
            ),
        );

        router.post(
            `/owner/product-categories/${category.id}/products/bulk-size`,
            fd,
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: (page: any) => {
                    const flash = page?.props?.flash ?? {};
                    const ids = flash.new_product_ids ?? [];
                    onSuccess?.(ids);
                    onClose?.();
                    setBulkSizeRows([
                        {
                            size: '',
                            center_price: '',
                            selling_price: '',
                            sku: '',
                        },
                    ]);
                    setBulkSizeFlavor('');
                    setBulkSizeDescription('');
                    setSharedImageFile(null);
                    setSharedImageExisting(null);
                },
                onError: (errors) => {
                    setBulkSizeErrors(errors as Record<string, string>);
                },
            },
        );
    };

    const handleBulkSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const flavors = parsedFlavors;

        if (flavors.length === 0) {
            setBulkErrors({ flavors: 'Isi minimal 1 rasa' });

            return;
        }

        if (
            Number(bulkForm.data.selling_price) <
            Number(bulkForm.data.center_price)
        ) {
            setBulkErrors({ selling_price: 'Harga jual harus >= HPP' });

            return;
        }

        setBulkErrors({});

        // Use Inertia router.post with JSON payload (as existing show.tsx did)
        router.post(
            `/owner/product-categories/${category.id}/products/bulk`,
            {
                flavors,
                size: bulkForm.data.size || null,
                center_price: Number(bulkForm.data.center_price),
                selling_price: Number(bulkForm.data.selling_price),
                description: bulkForm.data.description || null,
            },
            {
                preserveScroll: true,
                onSuccess: (page: any) => {
                    const flash = page?.props?.flash ?? {};
                    const ids = flash.new_product_ids ?? [];
                    onSuccess?.(ids);
                    onClose?.();
                    bulkForm.reset();
                    bulkForm.setData({
                        size: '200ml',
                        center_price: '30000',
                        selling_price: '40000',
                        flavors: [],
                        description: '',
                    });
                    setFlavorInput('');
                    setBulkFlavorsText('');
                },
                onError: (errors) => {
                    setBulkErrors(errors as Record<string, string>);
                },
            },
        );
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <h3 className="text-[13px] font-semibold tracking-wide text-text uppercase">
                            {isEditing
                                ? `Edit Produk - ${editingProduct?.name}`
                                : `Tambah Produk ke ${category.name}`}
                        </h3>
                    </div>
                </div>
                {isEditing && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-700 ring-1 ring-amber-200">
                        EDIT MODE
                    </span>
                )}
            </div>

            {/* Mode toggle - hidden when editing */}
            {!isEditing && (
                <div className="flex w-fit items-center gap-1 rounded-full bg-surface-muted p-1 ring-1 ring-border/30">
                    <button
                        type="button"
                        onClick={() => setMode('single')}
                        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${mode === 'single' ? 'bg-surface text-text shadow-sm ring-1 ring-border' : 'text-text-muted hover:text-text'}`}
                    >
                        <Package className="h-3.5 w-3.5" /> Single
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('bulk')}
                        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${mode === 'bulk' ? 'bg-surface text-text shadow-sm ring-1 ring-border' : 'text-text-muted hover:text-text'}`}
                    >
                        <Layers className="h-3.5 w-3.5" /> Multi Rasa
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('bulk-size')}
                        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${mode === 'bulk-size' ? 'bg-surface text-text shadow-sm ring-1 ring-border' : 'text-text-muted hover:text-text'}`}
                    >
                        <TrendingUp className="h-3.5 w-3.5" /> Multi Ukuran
                    </button>
                </div>
            )}

            {mode === 'single' ? (
                <form onSubmit={handleSingleSubmit} className="space-y-4">
                    {/* Name + SKU */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Input
                                label="Nama Produk *"
                                value={singleForm.data.name}
                                onChange={(e) =>
                                    singleForm.setData('name', e.target.value)
                                }
                                required
                                placeholder="Original 200ml"
                                error={singleForm.errors.name}
                            />
                        </div>
                        <div className="space-y-1">
                            <Input
                                label="SKU (auto jika kosong)"
                                value={singleForm.data.sku}
                                onChange={(e) =>
                                    singleForm.setData('sku', e.target.value)
                                }
                                placeholder="AUTO"
                                error={singleForm.errors.sku}
                            />
                            <p className="flex items-center gap-1 text-[10px] text-text-subtle">
                                <Sparkles className="h-3 w-3" />
                                Kosongkan untuk auto-generate. Contoh:{' '}
                                {generateSkuHint(
                                    singleForm.data.flavor,
                                    singleForm.data.size,
                                )}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <Input
                                label="Rasa"
                                value={singleForm.data.flavor}
                                onChange={(e) =>
                                    singleForm.setData('flavor', e.target.value)
                                }
                                placeholder="Coklat, Vanilla, Stroberi"
                                error={singleForm.errors.flavor}
                            />
                            <p className="text-[10px] text-text-subtle">
                                Optional - untuk varian rasa
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                            label="Ukuran"
                            value={singleForm.data.size}
                            onChange={(e) =>
                                singleForm.setData('size', e.target.value)
                            }
                            placeholder="200ml, 500ml, 1kg"
                            error={singleForm.errors.size}
                        />
                        <div className="rounded-lg bg-surface-muted/60 p-2.5 ring-1 ring-border/20">
                            <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-text-muted">
                                <TrendingUp className="h-3 w-3" /> Live Margin
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span
                                    className={`text-sm font-bold tabular-nums ${singleMargin.amount < 0 ? 'text-red-600' : singleMargin.pct < 20 ? 'text-amber-600' : 'text-emerald-700'}`}
                                >
                                    {singleMargin.valid
                                        ? formatCurrency(singleMargin.amount)
                                        : '-'}
                                </span>
                                <span
                                    className={`text-xs tabular-nums ${singleMargin.amount < 0 ? 'text-red-600' : singleMargin.pct < 20 ? 'text-amber-600' : 'text-emerald-700'}`}
                                >
                                    {singleMargin.valid
                                        ? `${singleMargin.pct.toFixed(1)}%`
                                        : '-'}
                                </span>
                                <span className="text-[10px] text-text-subtle">
                                    margin = jual - HPP, % = margin/HPP*100
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                            label="HPP / Center Price (Rp) *"
                            type="number"
                            min={0}
                            value={singleForm.data.center_price}
                            onChange={(e) =>
                                singleForm.setData(
                                    'center_price',
                                    e.target.value,
                                )
                            }
                            required
                            placeholder="30000"
                            error={singleForm.errors.center_price}
                        />
                        <Input
                            label="Harga Jual (Rp) *"
                            type="number"
                            min={0}
                            value={singleForm.data.selling_price}
                            onChange={(e) =>
                                singleForm.setData(
                                    'selling_price',
                                    e.target.value,
                                )
                            }
                            required
                            placeholder="40000"
                            error={
                                singleForm.errors.selling_price ||
                                (Number(singleForm.data.selling_price) <
                                    Number(singleForm.data.center_price) &&
                                singleForm.data.selling_price !== '' &&
                                singleForm.data.center_price !== ''
                                    ? 'Harus >= HPP'
                                    : undefined)
                            }
                        />
                    </div>

                    <Textarea
                        label="Deskripsi"
                        value={singleForm.data.description}
                        onChange={(e) =>
                            singleForm.setData('description', e.target.value)
                        }
                        rows={2}
                        placeholder="Deskripsi produk (opsional)"
                        error={singleForm.errors.description}
                    />

                    <ImageUploadField
                        value={
                            singleImageFile
                                ? singleImageFile
                                : singleImageExisting
                        }
                        onChange={(f) => {
                            setSingleImageFile(f);
                            singleForm.setData('image', f);

                            if (f === null) {
                                setSingleImageExisting(null);
                            }
                        }}
                        onRemove={
                            isEditing && editingProduct
                                ? () => {
                                      if (
                                          editingProduct.product_flavor_group_id
                                      ) {
                                          router.delete(
                                              `/owner/product-flavor-groups/${editingProduct.product_flavor_group_id}/image`,
                                              {
                                                  preserveScroll: true,
                                                  onSuccess: () => {
                                                      setSingleImageExisting(
                                                          null,
                                                      );
                                                      setSingleImageFile(null);
                                                  },
                                              },
                                          );
                                      } else {
                                          router.delete(
                                              `/owner/products/${editingProduct.id}/image`,
                                              {
                                                  preserveScroll: true,
                                                  onSuccess: () => {
                                                      setSingleImageExisting(
                                                          null,
                                                      );
                                                      setSingleImageFile(null);
                                                  },
                                              },
                                          );
                                      }
                                  }
                                : undefined
                        }
                        label="Foto Produk"
                    />
                    {singleForm.errors.image && (
                        <p className="text-xs text-red-600">
                            {singleForm.errors.image}
                        </p>
                    )}

                    <div className="flex items-center gap-2 rounded-lg bg-surface-muted/40 px-3 py-2 ring-1 ring-border/20">
                        <Checkbox
                            label="Produk Aktif"
                            checked={singleForm.data.is_active}
                            onChange={(e) =>
                                singleForm.setData(
                                    'is_active',
                                    e.target.checked,
                                )
                            }
                        />
                        <span className="ml-auto text-[11px] text-text-subtle">
                            Nonaktifkan untuk sembunyikan dari outlet
                        </span>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onClose?.()}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={singleForm.processing}>
                            {singleForm.processing
                                ? 'Menyimpan...'
                                : isEditing
                                  ? 'Update Produk'
                                  : 'Simpan Produk'}
                        </Button>
                    </div>
                </form>
            ) : mode === 'bulk' ? (
                <form onSubmit={handleBulkSubmit} className="space-y-4">
                    {/* Bulk fields */}
                    <div className="space-y-3 rounded-xl border border-border/20 bg-surface p-3">
                        <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                            Konfigurasi Bersama
                        </h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <Input
                                label="Ukuran (shared)"
                                value={bulkForm.data.size}
                                onChange={(e) =>
                                    bulkForm.setData('size', e.target.value)
                                }
                                placeholder="200ml"
                                error={bulkForm.errors.size || bulkErrors.size}
                            />
                            <Input
                                label="HPP (Rp) *"
                                type="number"
                                min={0}
                                value={bulkForm.data.center_price}
                                onChange={(e) =>
                                    bulkForm.setData(
                                        'center_price',
                                        e.target.value,
                                    )
                                }
                                required
                                placeholder="30000"
                                error={
                                    bulkForm.errors.center_price ||
                                    bulkErrors.center_price
                                }
                            />
                            <Input
                                label="Harga Jual (Rp) *"
                                type="number"
                                min={0}
                                value={bulkForm.data.selling_price}
                                onChange={(e) =>
                                    bulkForm.setData(
                                        'selling_price',
                                        e.target.value,
                                    )
                                }
                                required
                                placeholder="40000"
                                error={
                                    bulkForm.errors.selling_price ||
                                    bulkErrors.selling_price
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-emerald-50/60 p-2.5 ring-1 ring-emerald-200">
                            <div>
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                    <TrendingUp className="h-3 w-3" /> Margin &
                                    Jumlah
                                </div>
                                <div className="mt-0.5 text-[11px] text-text-subtle">
                                    Live kalkulasi untuk semua varian
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <span
                                        className={`text-sm font-bold tabular-nums ${bulkMargin.amount < 0 ? 'text-red-600' : bulkMargin.pct < 20 ? 'text-amber-600' : 'text-emerald-700'}`}
                                    >
                                        {bulkMargin.valid
                                            ? formatCurrency(bulkMargin.amount)
                                            : '-'}
                                    </span>
                                    <span
                                        className={`rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${bulkMargin.pct < 20 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
                                    >
                                        {bulkMargin.valid
                                            ? `${bulkMargin.pct.toFixed(1)}%`
                                            : '-'}
                                    </span>
                                </div>
                                <div className="mt-1 text-xs font-medium text-text">
                                    {parsedFlavors.length} varian akan dibuat
                                </div>
                            </div>
                        </div>

                        <Textarea
                            label="Deskripsi (shared, opsional)"
                            value={bulkForm.data.description}
                            onChange={(e) =>
                                bulkForm.setData('description', e.target.value)
                            }
                            rows={2}
                            placeholder="Deskripsi umum untuk semua rasa (opsional)"
                            error={
                                bulkForm.errors.description ||
                                bulkErrors.description
                            }
                        />
                    </div>

                    {/* Flavors input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text">
                            Daftar Rasa <span className="text-red-500">*</span>
                            <span className="ml-2 text-[11px] font-normal text-text-subtle">
                                Ketik + Enter atau koma untuk tambah chip
                            </span>
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    value={flavorInput}
                                    onChange={(e) =>
                                        setFlavorInput(e.target.value)
                                    }
                                    onKeyDown={handleFlavorInputKeyDown}
                                    placeholder="Coklat, Vanilla, lalu Enter"
                                    className="pr-10"
                                    error={bulkErrors.flavors}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={addFlavorChip}
                                size="sm"
                                className="h-9"
                            >
                                <Plus className="h-4 w-4" /> Tambah
                            </Button>
                        </div>

                        {/* Chips */}
                        {bulkForm.data.flavors.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {bulkForm.data.flavors.map((f) => (
                                    <span
                                        key={f}
                                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-primary/20"
                                    >
                                        {f}
                                        <button
                                            type="button"
                                            onClick={() => removeFlavorChip(f)}
                                            className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Alternative textarea for comma separated */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-text-muted">
                                Atau paste daftar rasa dipisah koma / baris baru
                                (auto dedup):
                            </label>
                            <Textarea
                                value={bulkFlavorsText}
                                onChange={(e) =>
                                    setBulkFlavorsText(e.target.value)
                                }
                                placeholder="Coklat, Vanilla&#10;Stroberi&#10;Matcha, Taro"
                                rows={2}
                            />
                            <p className="text-[10px] text-text-subtle">
                                Total unik: {parsedFlavors.length} rasa
                            </p>
                        </div>
                    </div>

                    {/* Preview list */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                                Preview Produk ({parsedFlavors.length})
                            </h4>
                            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                                {category.name} + Rasa +{' '}
                                {bulkForm.data.size || 'size'}
                            </span>
                        </div>
                        <div className="max-h-48 divide-y divide-border/30 overflow-y-auto rounded-lg border border-border/20 bg-surface">
                            {parsedFlavors.length === 0 ? (
                                <div className="p-4 text-center text-xs text-text-subtle">
                                    Belum ada rasa - tambah minimal 1
                                </div>
                            ) : (
                                parsedFlavors.map((flavor, idx) => {
                                    const name =
                                        `${flavor} ${bulkForm.data.size}`.trim();
                                    const skuPreview = generateSkuHint(
                                        flavor,
                                        bulkForm.data.size,
                                    );

                                    return (
                                        <div
                                            key={`${flavor}-${idx}`}
                                            className="flex items-center justify-between gap-3 px-3 py-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-muted text-[10px] font-bold text-text-muted">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="truncate text-sm font-medium text-text">
                                                        {name}
                                                    </span>
                                                </div>
                                                <div className="mt-0.5 ml-7 flex items-center gap-2 text-[10px] text-text-subtle">
                                                    <span>Rasa: {flavor}</span>
                                                    <span>•</span>
                                                    <span className="font-mono">
                                                        {skuPreview}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right tabular-nums">
                                                <div className="text-xs font-semibold text-text">
                                                    {formatCurrency(
                                                        bulkForm.data
                                                            .selling_price || 0,
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-text-subtle">
                                                    HPP{' '}
                                                    {formatCurrency(
                                                        bulkForm.data
                                                            .center_price || 0,
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {bulkErrors.flavors && (
                        <p className="text-xs text-red-600">
                            {bulkErrors.flavors}
                        </p>
                    )}
                    {bulkErrors.selling_price && (
                        <p className="text-xs text-red-600">
                            {bulkErrors.selling_price}
                        </p>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onClose?.()}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                bulkForm.processing ||
                                parsedFlavors.length === 0
                            }
                        >
                            {bulkForm.processing
                                ? 'Membuat...'
                                : `Buat ${parsedFlavors.length} Produk`}
                        </Button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleBulkSizeSubmit} className="space-y-4">
                    {/* Shared flavor + description */}
                    <div className="space-y-3 rounded-xl border border-border/20 bg-surface p-3">
                        <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                            Konfigurasi Rasa
                        </h4>
                        <Input
                            label="Rasa *"
                            value={bulkSizeFlavor}
                            onChange={(e) => setBulkSizeFlavor(e.target.value)}
                            placeholder="Coklat"
                            error={bulkSizeErrors.flavor}
                        />
                        <Textarea
                            label="Deskripsi (shared, opsional)"
                            value={bulkSizeDescription}
                            onChange={(e) =>
                                setBulkSizeDescription(e.target.value)
                            }
                            rows={2}
                            placeholder="Deskripsi umum untuk semua ukuran rasa ini (opsional)"
                            error={bulkSizeErrors.description}
                        />
                        <ImageUploadField
                            value={sharedImageFile || sharedImageExisting}
                            onChange={(f) => {
                                setSharedImageFile(f);

                                if (f === null) {
                                    setSharedImageExisting(null);
                                }
                            }}
                            label="Foto Rasa (shared untuk semua ukuran rasa ini)"
                            info="This image is shared by all Coffee sizes. Replacing it will update the image shown for every Coffee size."
                        />
                        {bulkSizeErrors.image && (
                            <p className="text-xs text-red-600">
                                {bulkSizeErrors.image}
                            </p>
                        )}
                    </div>

                    {/* Dynamic size rows */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                                Daftar Ukuran & Harga ({bulkSizeRows.length})
                            </h4>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addBulkSizeRow}
                            >
                                <Plus className="h-3.5 w-3.5" /> Tambah Ukuran
                            </Button>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-border/20">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-surface-muted/60 text-text-muted">
                                        <th className="px-2 py-2 font-semibold">
                                            #
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                            Ukuran
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                            HPP (Rp)
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                            Harga Jual (Rp)
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                            SKU AUTO
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                            Margin%
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                            Margin Rp
                                        </th>
                                        <th className="px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {bulkSizeRows.map((row, i) => {
                                        const margin = bulkSizeRowMargins[i];
                                        const skuHint = autoSku(row.size);

                                        return (
                                            <tr
                                                key={i}
                                                className="group hover:bg-surface-muted/30"
                                            >
                                                <td className="px-2 py-1.5 text-text-subtle">
                                                    {i + 1}
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <Input
                                                        value={row.size}
                                                        onChange={(e) =>
                                                            updateBulkSizeRow(
                                                                i,
                                                                'size',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="200ml"
                                                        className="h-8 text-xs"
                                                        error={
                                                            bulkSizeErrors[
                                                                `row_${i}_size`
                                                            ]
                                                        }
                                                    />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        value={row.center_price}
                                                        onChange={(e) =>
                                                            updateBulkSizeRow(
                                                                i,
                                                                'center_price',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="30000"
                                                        className="h-8 text-xs"
                                                        error={
                                                            bulkSizeErrors[
                                                                `row_${i}_center_price`
                                                            ]
                                                        }
                                                    />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        value={
                                                            row.selling_price
                                                        }
                                                        onChange={(e) =>
                                                            updateBulkSizeRow(
                                                                i,
                                                                'selling_price',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="40000"
                                                        className="h-8 text-xs"
                                                        error={
                                                            bulkSizeErrors[
                                                                `row_${i}_selling_price`
                                                            ] ||
                                                            (Number(
                                                                row.selling_price,
                                                            ) <
                                                                Number(
                                                                    row.center_price,
                                                                ) &&
                                                            row.selling_price !==
                                                                '' &&
                                                            row.center_price !==
                                                                ''
                                                                ? 'Harus >= HPP'
                                                                : undefined)
                                                        }
                                                    />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                value={row.sku}
                                                                onChange={(e) =>
                                                                    updateBulkSizeRow(
                                                                        i,
                                                                        'sku',
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                placeholder="AUTO"
                                                                className="h-8 font-mono text-xs"
                                                            />
                                                        </div>
                                                        {!row.sku.trim() &&
                                                            skuHint && (
                                                                <p className="text-[10px] text-text-subtle">
                                                                    {skuHint}
                                                                </p>
                                                            )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <span
                                                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${margin.amount < 0 ? 'text-red-600' : margin.pct < 20 ? 'text-amber-600' : 'text-emerald-700'}`}
                                                    >
                                                        {margin.valid
                                                            ? `${margin.pct.toFixed(1)}%`
                                                            : '-'}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <span
                                                        className={`text-xs font-bold tabular-nums ${margin.amount < 0 ? 'text-red-600' : 'text-emerald-700'}`}
                                                    >
                                                        {margin.valid
                                                            ? formatCurrency(
                                                                  margin.amount,
                                                              )
                                                            : '-'}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    {bulkSizeRows.length >
                                                        1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeBulkSizeRow(
                                                                    i,
                                                                )
                                                            }
                                                            className="rounded p-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Preview list */}
                    {bulkSizeFlavor.trim() &&
                        bulkSizeRows.some((r) => r.size.trim()) && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                                        Preview Produk (
                                        {
                                            bulkSizeRows.filter((r) =>
                                                r.size.trim(),
                                            ).length
                                        }
                                        )
                                    </h4>
                                    <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                                        {bulkSizeFlavor.trim()} + Ukuran
                                    </span>
                                </div>
                                <div className="divide-y divide-border/30 rounded-lg border border-border/20 bg-surface">
                                    {bulkSizeRows
                                        .filter((r) => r.size.trim())
                                        .map((row, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between gap-3 px-3 py-2"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-muted text-[10px] font-bold text-text-muted">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="truncate text-sm font-medium text-text">
                                                            {`${bulkSizeFlavor.trim()} ${row.size}`}
                                                        </span>
                                                    </div>
                                                    <div className="mt-0.5 ml-7 flex items-center gap-2 text-[10px] text-text-subtle">
                                                        <span>
                                                            Ukuran: {row.size}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="font-mono">
                                                            {row.sku.trim() ||
                                                                autoSku(
                                                                    row.size,
                                                                )}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right tabular-nums">
                                                    <div className="text-xs font-semibold text-text">
                                                        {formatCurrency(
                                                            Number(
                                                                row.selling_price,
                                                            ) || 0,
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-text-subtle">
                                                        HPP{' '}
                                                        {formatCurrency(
                                                            Number(
                                                                row.center_price,
                                                            ) || 0,
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                    {bulkSizeErrors.rows && (
                        <p className="text-xs text-red-600">
                            {bulkSizeErrors.rows}
                        </p>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onClose?.()}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={bulkSizeRows.length === 0}
                        >
                            Buat {bulkSizeRows.length} Produk
                        </Button>
                    </div>
                </form>
            )}

            {/* Validation summary */}
            {(singleForm.hasErrors ||
                Object.keys(bulkErrors).length > 0 ||
                Object.keys(bulkSizeErrors).length > 0) && (
                <div className="rounded-lg bg-red-50 p-2.5 ring-1 ring-red-200">
                    <p className="text-xs font-semibold text-red-700">
                        Periksa kembali isian form:
                    </p>
                    <ul className="mt-1 list-disc pl-4 text-[11px] text-red-600">
                        {Object.entries({
                            ...singleForm.errors,
                            ...(mode === 'bulk' ? bulkErrors : {}),
                            ...(mode === 'bulk-size' ? bulkSizeErrors : {}),
                        }).map(([k, v]) => (
                            <li key={k}>
                                {k}: {String(v)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
