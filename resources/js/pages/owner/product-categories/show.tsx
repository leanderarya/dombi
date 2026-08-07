import { router } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronRight,
    Copy,
    Package,
    Pencil,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Plus,
    Layers,
    Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import ImageUploadField from '@/components/owner/image-upload-field';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import ProductImage from '@/components/owner/product-image';
import ProductSearchFilters from '@/components/owner/product-search-filters';
import SetupCenterStockModal from '@/components/owner/setup-center-stock-modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/format';
import type {
    ProductCategory,
    Product,
    ProductFlavorGroup,
} from '@/types/product';

interface Props {
    category: ProductCategory;
}

interface Props {
    category: ProductCategory;
}

export default function ProductCategoryShow({ category }: Props) {
    const [search, setSearch] = useState('');
    const [productFilter, setProductFilter] = useState<string>('all');

    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteCatDialog, setDeleteCatDialog] = useState(false);

    // Soft delete guard dialog
    const [softDeleteId, setSoftDeleteId] = useState<number | null>(null);
    const [softDeleteDialog, setSoftDeleteDialog] = useState(false);

    // Category edit
    const [showCatEdit, setShowCatEdit] = useState(false);
    const [catForm, setCatForm] = useState({
        name: category?.name ?? '',
        description: category?.description ?? '',
        is_active: category?.is_active ?? true,
    });
    const [catProcessing, setCatProcessing] = useState(false);

    // Product create/edit
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [productForm, setProductForm] = useState({
        name: '',
        flavor: '',
        size: '',
        sku: '',
        center_price: '',
        selling_price: '',
        description: '',
        is_active: true,
    });
    const [productImageFile, setProductImageFile] = useState<File | null>(null);
    const [productImageExisting, setProductImageExisting] = useState<
        string | null
    >(null);
    const [productProcessing, setProductProcessing] = useState(false);

    // Bulk create
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [bulkForm, setBulkForm] = useState({
        flavorsText: '',
        size: '',
        center_price: '',
        selling_price: '',
        description: '',
    });
    const [bulkProcessing, setBulkProcessing] = useState(false);

    // Setup stock modal
    const [showSetup, setShowSetup] = useState(false);
    const [newProducts, setNewProducts] = useState<Product[]>([]);

    const filteredProducts = useMemo(() => {
        if (!category?.products) {
            return [];
        }

        let list = [...category.products];

        if (search) {
            const q = search.toLowerCase();
            list = list.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    (p.sku?.toLowerCase().includes(q) ?? false) ||
                    (p.flavor?.toLowerCase().includes(q) ?? false) ||
                    (p.size?.toLowerCase().includes(q) ?? false),
            );
        }

        switch (productFilter) {
            case 'active':
                list = list.filter((p) => p.is_active);
                break;
            case 'inactive':
                list = list.filter((p) => !p.is_active);
                break;
            case 'out_of_stock':
                list = list.filter((p) => p.center_stock === 0);
                break;
            case 'low_stock':
                list = list.filter(
                    (p) => p.center_stock > 0 && p.center_stock <= 5,
                );
                break;
            case 'has_image':
                list = list.filter((p) => !!p.image);
                break;
            case 'no_image':
                list = list.filter((p) => !p.image);
                break;
            default:
                break;
        }

        return list;
    }, [category, search, productFilter]);

    // Group filtered products by flavor group
    const groupedSections = useMemo(() => {
        const groups: {
            flavorGroup: ProductFlavorGroup | null;
            products: Product[];
        }[] = [];

        if (!filteredProducts.length) {
            return groups;
        }

        const grouped = new Map<number | 'null', Product[]>();

        for (const p of filteredProducts) {
            const key = p.product_flavor_group_id ?? 'null';

            if (!grouped.has(key)) {
                grouped.set(key, []);
            }

            grouped.get(key)!.push(p);
        }

        // Sort flavor groups to match category.flavor_groups order
        const groupOrder = category.flavor_groups ?? [];
        const groupMap = new Map(groupOrder.map((g) => [g.id, g]));

        // Known groups first (in order), then unknown group IDs, then null
        const knownIds = groupOrder.map((g) => g.id);
        const unknownIds = [...grouped.keys()].filter(
            (k) => k !== 'null' && !knownIds.includes(k as number),
        );
        const allKeys: (number | 'null')[] = [
            ...knownIds.filter((k) => grouped.has(k)),
            ...unknownIds,
        ];

        if (grouped.has('null')) {
            allKeys.push('null');
        }

        for (const key of allKeys) {
            const fg =
                key === 'null' ? null : (groupMap.get(key as number) ?? null);
            groups.push({ flavorGroup: fg, products: grouped.get(key)! });
        }

        return groups;
    }, [filteredProducts, category.flavor_groups]);

    // Flavor group image upload
    const [editingFlavorGroup, setEditingFlavorGroup] =
        useState<ProductFlavorGroup | null>(null);
    const [fgImageFile, setFgImageFile] = useState<File | null>(null);
    const [fgProcessing, setFgProcessing] = useState(false);

    const handleFgImageSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingFlavorGroup || !fgImageFile) {
            return;
        }

        setFgProcessing(true);
        const fd = new FormData();
        fd.append('image', fgImageFile);
        fd.append('_method', 'PATCH');
        router.post(
            `/owner/product-flavor-groups/${editingFlavorGroup.id}/image`,
            fd,
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Gambar grup rasa diperbarui');
                    setEditingFlavorGroup(null);
                    setFgImageFile(null);
                },
                onError: (err) =>
                    toast.error(Object.values(err).flat().join(', ')),
                onFinish: () => setFgProcessing(false),
            },
        );
    };

    const [expandedGroups, setExpandedGroups] = useState<Set<number | 'null'>>(
        new Set(),
    );

    const toggleGroup = (key: number | 'null') => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    };

    const handleCatUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setCatProcessing(true);
        const fd = new FormData();
        fd.append('name', catForm.name);

        if (catForm.description) {
            fd.append('description', catForm.description);
        }

        fd.append('is_active', catForm.is_active ? '1' : '0');

        fd.append('_method', 'PUT');

        router.post(`/owner/product-categories/${category.id}`, fd, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Kategori berhasil diperbarui');
                setShowCatEdit(false);
            },
            onError: (errors) =>
                toast.error(Object.values(errors).flat().join(', ')),
            onFinish: () => setCatProcessing(false),
        });
    };

    const handleDeleteCategory = () => {
        router.delete(`/owner/product-categories/${category.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Kategori berhasil dihapus');
                setDeleteCatDialog(false);
            },
            onError: () =>
                toast.error('Gagal menghapus kategori dengan produk'),
        });
    };

    const openCreateProduct = () => {
        setEditingProduct(null);
        setProductForm({
            name: '',
            flavor: '',
            size: '',
            sku: '',
            center_price: '',
            selling_price: '',
            description: '',
            is_active: true,
        });
        setProductImageFile(null);
        setProductImageExisting(null);
        setShowProductForm(true);
    };

    const openEditProduct = (p: Product) => {
        setEditingProduct(p);
        setProductForm({
            name: p.name,
            flavor: p.flavor ?? '',
            size: p.size ?? '',
            sku: p.sku ?? '',
            center_price: String(p.center_price),
            selling_price: String(p.selling_price),
            description: p.description ?? '',
            is_active: p.is_active,
        });
        setProductImageExisting(p.display_image ?? null);
        setProductImageFile(null);
        setShowProductForm(true);
    };

    const handleProductSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setProductProcessing(true);
        const fd = new FormData();
        fd.append('name', productForm.name);

        if (productForm.flavor) {
            fd.append('flavor', productForm.flavor);
        }

        if (productForm.size) {
            fd.append('size', productForm.size);
        }

        if (productForm.sku) {
            fd.append('sku', productForm.sku);
        }

        fd.append('center_price', productForm.center_price);
        fd.append('selling_price', productForm.selling_price);

        if (productForm.description) {
            fd.append('description', productForm.description);
        }

        fd.append('is_active', productForm.is_active ? '1' : '0');

        if (productImageFile) {
            fd.append('image', productImageFile);
        }

        if (editingProduct) {
            fd.append('_method', 'PUT');
            router.post(`/owner/products/${editingProduct.id}`, fd, {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Produk berhasil diperbarui');
                    setShowProductForm(false);
                    setEditingProduct(null);
                },
                onError: (err) =>
                    toast.error(Object.values(err).flat().join(', ')),
                onFinish: () => setProductProcessing(false),
            });
        } else {
            router.post(
                `/owner/product-categories/${category.id}/products`,
                fd,
                {
                    forceFormData: true,
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Produk berhasil dibuat');
                        setShowProductForm(false);
                    },
                    onError: (err) =>
                        toast.error(Object.values(err).flat().join(', ')),
                    onFinish: () => setProductProcessing(false),
                },
            );
        }
    };

    const handleBulkSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const flavors = bulkForm.flavorsText
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean);

        if (flavors.length === 0) {
            toast.error('Isi minimal 1 rasa');

            return;
        }

        setBulkProcessing(true);
        router.post(
            `/owner/product-categories/${category.id}/products/bulk`,
            {
                flavors,
                size: bulkForm.size || null,
                center_price: Number(bulkForm.center_price),
                selling_price: Number(bulkForm.selling_price),
                description: bulkForm.description || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`${flavors.length} produk berhasil dibuat`);
                    setShowBulkForm(false);
                    setBulkForm({
                        flavorsText: '',
                        size: '',
                        center_price: '',
                        selling_price: '',
                        description: '',
                    });
                },
                onError: (err) =>
                    toast.error(Object.values(err).flat().join(', ')),
                onFinish: () => setBulkProcessing(false),
            },
        );
    };

    const handleDeleteProduct = () => {
        if (!deleteId) {
            return;
        }

        router.delete(`/owner/products/${deleteId}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Produk berhasil dihapus');
                setDeleteId(null);
            },
            onError: (errors) => {
                const errMsg = Object.values(errors).flat().join(', ');

                if (
                    errMsg.toLowerCase().includes('riwayat') ||
                    errMsg.toLowerCase().includes('stok')
                ) {
                    setDeleteId(null);
                    setSoftDeleteId(deleteId);
                    setSoftDeleteDialog(true);
                } else {
                    toast.error(errMsg || 'Gagal menghapus produk');
                }
            },
        });
    };

    const handleSoftDeleteDeactivate = () => {
        if (!softDeleteId) {
            return;
        }

        router.patch(
            `/owner/products/${softDeleteId}/toggle`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Produk dinonaktifkan');
                    setSoftDeleteDialog(false);
                    setSoftDeleteId(null);
                },
                onError: () => toast.error('Gagal menonaktifkan produk'),
            },
        );
    };

    const handleDuplicate = (p: Product) => {
        router.post(
            `/owner/products/${p.id}/duplicate`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Produk berhasil duplikasi, setup stok');
                    // flash will trigger modal via useEffect
                },
                onError: () => toast.error('Gagal menduplikasi produk'),
            },
        );
    };

    const handleToggle = (p: Product) => {
        router.patch(
            `/owner/products/${p.id}/toggle`,
            {},
            {
                preserveScroll: true,
                onSuccess: () =>
                    toast.success(
                        p.is_active
                            ? 'Produk dinonaktifkan'
                            : 'Produk diaktifkan',
                    ),
                onError: () => toast.error('Gagal mengubah status'),
            },
        );
    };

    if (!category) {
        return (
            <OwnerPageShell title="Kategori" subtitle="Memuat...">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell
            title={`Kategori: ${category.name}`}
            subtitle={'Detail kategori'}
            backHref="/owner/product-categories"
            headerRight={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setShowCatEdit(true)}
                    >
                        <Pencil className="mr-1 h-4 w-4" /> Edit Kategori
                    </Button>
                    <Button
                        variant="danger"
                        size="lg"
                        onClick={() => setDeleteCatDialog(true)}
                    >
                        <Trash2 className="mr-1 h-4 w-4" /> Hapus
                    </Button>
                </div>
            }
        >
            {category.description && (
                <div className="mb-4 rounded-2xl border border-border bg-surface p-5">
                    <p className="text-sm text-text-muted">
                        {category.description}
                    </p>
                </div>
            )}

            <ProductSearchFilters
                search={search}
                onSearch={setSearch}
                filter={productFilter}
                onFilterChange={setProductFilter}
            />

            <div className="mb-4 flex items-center justify-end gap-2">
                <Button
                    variant="outline"
                    size="lg"
                    className="bg-accent-orange hover:bg-accent-orange-hover text-white border-transparent"
                    onClick={() => setShowBulkForm(true)}
                >
                    <Layers className="mr-1 h-4 w-4" /> Tambah Multi Rasa
                </Button>
                <Button
                    size="lg"
                    className="bg-accent-orange hover:bg-accent-orange-hover"
                    onClick={openCreateProduct}
                >
                    <Plus className="mr-1 h-4 w-4" /> Tambah Produk
                </Button>
            </div>

            {filteredProducts.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-muted" />}
                    title={
                        category.products?.length === 0
                            ? 'Belum ada produk'
                            : 'Tidak ditemukan'
                    }
                    description={
                        category.products?.length === 0
                            ? 'Tambah produk pertama'
                            : 'Coba kata kunci lain'
                    }
                    action={
                        category.products?.length === 0
                            ? {
                                  label: 'Tambah Produk',
                                  onClick: openCreateProduct,
                              }
                            : undefined
                    }
                />
            ) : (
                <div className="space-y-4">
                    {groupedSections.map((section, idx) => {
                        const gKey = section.flavorGroup?.id ?? 'null';
                        const isExpanded = expandedGroups.has(gKey);
                        const sizeCount = new Set(
                            section.products.map((p) => p.size),
                        ).size;

                        return (
                            <div
                                key={
                                    gKey === 'null'
                                        ? `null-${idx}`
                                        : `fg-${gKey}`
                                }
                                className="overflow-hidden rounded-2xl border border-border bg-surface"
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(gKey)}
                                    className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-surface-muted/30 min-h-[44px]"
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
                                    )}
                                    <ProductImage
                                        name={
                                            section.flavorGroup?.flavor ??
                                            'Tanpa Rasa'
                                        }
                                        src={null}
                                        flavorGroupImage={
                                            section.flavorGroup?.image ?? null
                                        }
                                        size="sm"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <span className="text-sm font-semibold text-text">
                                            {section.flavorGroup?.flavor ??
                                                'Tanpa Rasa'}
                                        </span>
                                        <span className="ml-2 text-xs text-text-muted tabular-nums">
                                            {section.products.length} varian ·{' '}
                                            {sizeCount} ukuran
                                        </span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {section.flavorGroup &&
                                            !section.flavorGroup.image && (
                                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 ring-1 ring-amber-200">
                                                    Missing Image
                                                </span>
                                            )}
                                        {section.flavorGroup && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingFlavorGroup(
                                                        section.flavorGroup!,
                                                    );
                                                    setFgImageFile(null);
                                                }}
                                                className="h-11 w-11 flex items-center justify-center rounded text-text-subtle hover:bg-mint-wash hover:text-text"
                                                title="Edit gambar grup"
                                            >
                                                <Upload className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border bg-surface-muted/50 text-left">
                                                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
                                                        Produk
                                                    </th>
                                                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
                                                        Ukuran
                                                    </th>
                                                    <th className="px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
                                                        SKU
                                                    </th>
                                                    <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase">
                                                        HPP
                                                    </th>
                                                    <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase">
                                                        Hrg Jual
                                                    </th>
                                                    <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase">
                                                        Margin%
                                                    </th>
                                                    <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase">
                                                        Stok Pusat
                                                    </th>
                                                    <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-text-muted uppercase">
                                                        Aksi
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50">
                                                {section.products.map((p) => {
                                                    const margin =
                                                        Number(
                                                            p.selling_price,
                                                        ) -
                                                        Number(p.center_price);
                                                    const marginPct =
                                                        Number(p.center_price) >
                                                        0
                                                            ? (margin /
                                                                  Number(
                                                                      p.center_price,
                                                                  )) *
                                                              100
                                                            : 0;
                                                    const hasNoStock =
                                                        p.center_stock === 0;

                                                    return (
                                                        <tr
                                                            key={p.id}
                                                            className={`transition hover:bg-mint-wash/30 ${!p.is_active ? 'opacity-60' : ''}`}
                                                        >
                                                            <td className="px-3 py-3">
                                                                <div className="flex items-center gap-2.5">
                                                                    <ProductImage
                                                                        name={
                                                                            p.name
                                                                        }
                                                                        src={
                                                                            p.image
                                                                        }
                                                                        flavorGroupImage={
                                                                            p
                                                                                .flavor_group
                                                                                ?.image
                                                                        }
                                                                        size="sm"
                                                                    />
                                                                    <div className="min-w-0">
                                                                        <div className="max-w-[200px] truncate font-semibold text-text">
                                                                            {
                                                                                p.name
                                                                            }
                                                                        </div>
                                                                        <div className="mt-0.5 flex items-center gap-1.5">
                                                                            {!p.is_active && (
                                                                                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-muted">
                                                                                    NONAKTIF
                                                                                </span>
                                                                            )}
                                                                            {!p.image && (
                                                                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 ring-1 ring-amber-200">
                                                                                    No
                                                                                    Image
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 text-text-muted">
                                                                {p.size || '-'}
                                                            </td>
                                                            <td className="px-3 py-3 font-mono text-xs text-text-muted tabular-nums">
                                                                {p.sku || '-'}
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-text-muted tabular-nums">
                                                                {formatCurrency(
                                                                    p.center_price,
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3 text-right font-semibold text-text tabular-nums">
                                                                {formatCurrency(
                                                                    p.selling_price,
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3 text-right tabular-nums">
                                                                <span
                                                                    className={
                                                                        marginPct <
                                                                        20
                                                                            ? 'text-amber-600'
                                                                            : 'text-emerald-700'
                                                                    }
                                                                >
                                                                    {marginPct.toFixed(
                                                                        1,
                                                                    )}
                                                                    %
                                                                </span>
                                                                <span className="ml-1 text-[11px] text-text-subtle">
                                                                    (
                                                                    {formatCurrency(
                                                                        margin,
                                                                    )}
                                                                    )
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-right tabular-nums">
                                                                {hasNoStock ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                                                                        0
                                                                        <span className="ml-1 rounded bg-red-100 px-1 py-0 text-[9px]">
                                                                            No
                                                                            Center
                                                                            Stock
                                                                        </span>
                                                                    </span>
                                                                ) : (
                                                                    <span
                                                                        className={
                                                                            p.center_stock <=
                                                                            5
                                                                                ? 'font-bold text-amber-600'
                                                                                : 'text-text'
                                                                        }
                                                                    >
                                                                        {
                                                                            p.center_stock
                                                                        }
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <div className="flex items-center justify-center gap-0.5">
                                                                    <button
                                                                        title="Duplikat"
                                                                        onClick={() =>
                                                                            handleDuplicate(
                                                                                p,
                                                                            )
                                                                        }
                                                                        className="h-11 w-11 flex items-center justify-center rounded text-text-subtle hover:bg-mint-wash hover:text-text"
                                                                    >
                                                                        <Copy className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        title={
                                                                            p.is_active
                                                                                ? 'Nonaktifkan'
                                                                                : 'Aktifkan'
                                                                        }
                                                                        onClick={() =>
                                                                            handleToggle(
                                                                                p,
                                                                            )
                                                                        }
                                                                        className="h-11 w-11 flex items-center justify-center rounded text-text-subtle hover:bg-mint-wash hover:text-text"
                                                                    >
                                                                        {p.is_active ? (
                                                                            <ToggleRight className="h-3.5 w-3.5 text-primary" />
                                                                        ) : (
                                                                            <ToggleLeft className="h-3.5 w-3.5" />
                                                                        )}
                                                                    </button>
                                                                    <button
                                                                        title="Edit"
                                                                        onClick={() =>
                                                                            openEditProduct(
                                                                                p,
                                                                            )
                                                                        }
                                                                        className="h-11 w-11 flex items-center justify-center rounded text-text-subtle hover:bg-mint-wash hover:text-text"
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        title="Hapus"
                                                                        onClick={() =>
                                                                            setDeleteId(
                                                                                p.id,
                                                                            )
                                                                        }
                                                                        className="h-11 w-11 flex items-center justify-center rounded text-text-subtle hover:bg-red-50 hover:text-red-600"
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
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Category Edit Dialog */}
            <Dialog
                open={showCatEdit}
                onOpenChange={(o) => !o && setShowCatEdit(false)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Edit Kategori: {category.name}
                        </DialogTitle>
                        <DialogDescription>
                            Perbarui kategori produk.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCatUpdate} className="space-y-3">
                        <Input
                            label="Nama Kategori"
                            value={catForm.name}
                            onChange={(e) =>
                                setCatForm((p) => ({
                                    ...p,
                                    name: e.target.value,
                                }))
                            }
                            required
                        />
                        <Textarea
                            label="Deskripsi"
                            value={catForm.description}
                            onChange={(e) =>
                                setCatForm((p) => ({
                                    ...p,
                                    description: e.target.value,
                                }))
                            }
                            rows={2}
                        />
                        <Checkbox
                            label="Aktif"
                            checked={catForm.is_active}
                            onChange={(e) =>
                                setCatForm((p) => ({
                                    ...p,
                                    is_active: e.target.checked,
                                }))
                            }
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowCatEdit(false)}
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={catProcessing}>
                                {catProcessing ? 'Menyimpan...' : 'Update'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Product Form Dialog */}
            <Dialog
                open={showProductForm}
                onOpenChange={(o) => {
                    if (!o) {
                        setShowProductForm(false);
                        setEditingProduct(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingProduct ? 'Edit Produk' : 'Tambah Produk'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingProduct
                                ? `Perbarui ${editingProduct.name}`
                                : `Tambah produk ke kategori ${category.name}`}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleProductSubmit} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Nama Produk"
                                value={productForm.name}
                                onChange={(e) =>
                                    setProductForm((p) => ({
                                        ...p,
                                        name: e.target.value,
                                    }))
                                }
                                required
                                placeholder="Original 200ml"
                            />
                            <Input
                                label="SKU (auto jika kosong)"
                                value={productForm.sku}
                                onChange={(e) =>
                                    setProductForm((p) => ({
                                        ...p,
                                        sku: e.target.value,
                                    }))
                                }
                                placeholder="AUTO"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Rasa"
                                value={productForm.flavor}
                                onChange={(e) =>
                                    setProductForm((p) => ({
                                        ...p,
                                        flavor: e.target.value,
                                    }))
                                }
                                placeholder="Coklat"
                            />
                            <Input
                                label="Ukuran"
                                value={productForm.size}
                                onChange={(e) =>
                                    setProductForm((p) => ({
                                        ...p,
                                        size: e.target.value,
                                    }))
                                }
                                placeholder="200ml"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="HPP (Rp)"
                                type="number"
                                value={productForm.center_price}
                                onChange={(e) =>
                                    setProductForm((p) => ({
                                        ...p,
                                        center_price: e.target.value,
                                    }))
                                }
                                required
                                min={0}
                            />
                            <Input
                                label="Harga Jual (Rp)"
                                type="number"
                                value={productForm.selling_price}
                                onChange={(e) =>
                                    setProductForm((p) => ({
                                        ...p,
                                        selling_price: e.target.value,
                                    }))
                                }
                                required
                                min={0}
                            />
                        </div>
                        <Textarea
                            label="Deskripsi"
                            value={productForm.description}
                            onChange={(e) =>
                                setProductForm((p) => ({
                                    ...p,
                                    description: e.target.value,
                                }))
                            }
                            rows={2}
                        />
                        <ImageUploadField
                            value={
                                productImageFile
                                    ? productImageFile
                                    : productImageExisting
                            }
                            onChange={(f) => {
                                setProductImageFile(f);

                                if (f === null) {
                                    setProductImageExisting(null);
                                }
                            }}
                            onRemove={
                                editingProduct
                                    ? () => {
                                          if (
                                              editingProduct.product_flavor_group_id
                                          ) {
                                              router.delete(
                                                  `/owner/product-flavor-groups/${editingProduct.product_flavor_group_id}/image`,
                                                  {
                                                      preserveScroll: true,
                                                      onSuccess: () => {
                                                          setProductImageExisting(
                                                              null,
                                                          );
                                                          setProductImageFile(
                                                              null,
                                                          );
                                                      },
                                                  },
                                              );
                                          } else {
                                              router.delete(
                                                  `/owner/products/${editingProduct.id}/image`,
                                                  {
                                                      preserveScroll: true,
                                                      onSuccess: () => {
                                                          setProductImageExisting(
                                                              null,
                                                          );
                                                          setProductImageFile(
                                                              null,
                                                          );
                                                      },
                                                  },
                                              );
                                          }
                                      }
                                    : undefined
                            }
                            label="Foto Produk"
                        />
                        <Checkbox
                            label="Aktif"
                            checked={productForm.is_active}
                            onChange={(e) =>
                                setProductForm((p) => ({
                                    ...p,
                                    is_active: e.target.checked,
                                }))
                            }
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setShowProductForm(false);
                                    setEditingProduct(null);
                                }}
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={productProcessing}>
                                {productProcessing
                                    ? 'Menyimpan...'
                                    : editingProduct
                                      ? 'Update'
                                      : 'Simpan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Bulk Form Dialog */}
            <Dialog
                open={showBulkForm}
                onOpenChange={(o) => !o && setShowBulkForm(false)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tambah Multi Rasa</DialogTitle>
                        <DialogDescription>
                            Buat banyak varian rasa sekaligus dalam kategori{' '}
                            {category.name}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleBulkSubmit} className="space-y-3">
                        <Textarea
                            label="Daftar Rasa (pisah koma atau baris baru)"
                            value={bulkForm.flavorsText}
                            onChange={(e) =>
                                setBulkForm((p) => ({
                                    ...p,
                                    flavorsText: e.target.value,
                                }))
                            }
                            required
                            placeholder="Coklat, Vanilla, Stroberi"
                            rows={3}
                        />
                        <Input
                            label="Ukuran (opsional)"
                            value={bulkForm.size}
                            onChange={(e) =>
                                setBulkForm((p) => ({
                                    ...p,
                                    size: e.target.value,
                                }))
                            }
                            placeholder="200ml"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="HPP (Rp)"
                                type="number"
                                value={bulkForm.center_price}
                                onChange={(e) =>
                                    setBulkForm((p) => ({
                                        ...p,
                                        center_price: e.target.value,
                                    }))
                                }
                                required
                                min={0}
                            />
                            <Input
                                label="Harga Jual (Rp)"
                                type="number"
                                value={bulkForm.selling_price}
                                onChange={(e) =>
                                    setBulkForm((p) => ({
                                        ...p,
                                        selling_price: e.target.value,
                                    }))
                                }
                                required
                                min={0}
                            />
                        </div>
                        <Textarea
                            label="Deskripsi (opsional)"
                            value={bulkForm.description}
                            onChange={(e) =>
                                setBulkForm((p) => ({
                                    ...p,
                                    description: e.target.value,
                                }))
                            }
                            rows={2}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowBulkForm(false)}
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={bulkProcessing}>
                                {bulkProcessing ? 'Membuat...' : 'Buat'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Product */}
            <Dialog
                open={deleteId !== null}
                onOpenChange={() => setDeleteId(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Produk</DialogTitle>
                        <DialogDescription>
                            Yakin ingin menghapus produk ini? Produk dengan
                            riwayat transaksi tidak dapat dihapus (soft delete
                            guard).
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
                            onClick={handleDeleteProduct}
                        >
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Soft Delete Guard → Deactivate Dialog */}
            <Dialog
                open={softDeleteDialog}
                onOpenChange={(o) => {
                    if (!o) {
                        setSoftDeleteDialog(false);
                        setSoftDeleteId(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tidak Bisa Hapus</DialogTitle>
                        <DialogDescription>
                            Tidak bisa hapus, produk sudah dipakai di pesanan.
                            Nonaktifkan saja?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSoftDeleteDialog(false);
                                setSoftDeleteId(null);
                            }}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleSoftDeleteDeactivate}
                        >
                            Deactivate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Category */}
            <Dialog open={deleteCatDialog} onOpenChange={setDeleteCatDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Kategori</DialogTitle>
                        <DialogDescription>
                            Semua produk harus dihapus terlebih dahulu. Yakin
                            hapus kategori {category.name}?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteCatDialog(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteCategory}
                        >
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Flavor Group Image Dialog */}
            <Dialog
                open={editingFlavorGroup !== null}
                onOpenChange={(o) => {
                    if (!o) {
                        setEditingFlavorGroup(null);
                        setFgImageFile(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Gambar Grup Rasa: {editingFlavorGroup?.flavor}
                        </DialogTitle>
                        <DialogDescription>
                            Unggah gambar untuk grup rasa{' '}
                            {editingFlavorGroup?.flavor}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleFgImageSubmit} className="space-y-3">
                        <ImageUploadField
                            value={
                                fgImageFile ?? editingFlavorGroup?.image ?? null
                            }
                            onChange={setFgImageFile}
                            label="Foto Grup Rasa"
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setEditingFlavorGroup(null);
                                    setFgImageFile(null);
                                }}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={fgProcessing || !fgImageFile}
                            >
                                {fgProcessing ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <SetupCenterStockModal
                products={newProducts}
                open={showSetup}
                onClose={() => {
                    setShowSetup(false);
                    setNewProducts([]);
                }}
            />
        </OwnerPageShell>
    );
}
