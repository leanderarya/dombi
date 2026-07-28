import { router, usePage } from '@inertiajs/react';
import {
    Copy,
    Package,
    Pencil,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Plus,
    Layers,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import ProductImage from '@/components/owner/product-image';
import ProductSearchFilters from '@/components/owner/product-search-filters';
import type { ProductFilterValue } from '@/components/owner/product-search-filters';
import SetupCenterStockModal from '@/components/owner/setup-center-stock-modal';
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
import { SkeletonPage } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatMarginPercent } from '@/lib/format';
import type { ProductCategory, Product } from '@/types/product';
import ImageUploadField from '@/components/owner/image-upload-field';

interface Props {
    category: ProductCategory;
}

interface FlashProps {
    flash?: {
        success?: string;
        error?: string;
        new_product_id?: number;
        new_product_ids?: number[];
    };
    [k: string]: any;
}

export default function ProductCategoryShow({ category }: Props) {
    const { props } = usePage<FlashProps>();
    const [search, setSearch] = useState('');
    const [productFilter, setProductFilter] = useState<ProductFilterValue>('all');

    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleteCatDialog, setDeleteCatDialog] = useState(false);

    // Soft delete guard dialog
    const [softDeleteId, setSoftDeleteId] = useState<number | null>(null);
    const [softDeleteDialog, setSoftDeleteDialog] = useState(false);

    // Category edit
    const [showCatEdit, setShowCatEdit] = useState(false);
    const [catForm, setCatForm] = useState({
        name: category?.name ?? '',
        brand: category?.brand ?? '',
        description: category?.description ?? '',
        is_active: category?.is_active ?? true,
    });
    const [catImageFile, setCatImageFile] = useState<File | null>(null);
    const [catImageExisting, setCatImageExisting] = useState<string | null>(category?.image ?? null);
    const [catProcessing, setCatProcessing] = useState(false);

    useEffect(() => {
        if (category) {
            setCatForm({
                name: category.name,
                brand: category.brand ?? '',
                description: category.description ?? '',
                is_active: category.is_active,
            });
            setCatImageExisting(category.image ?? null);
        }
    }, [category]);

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
    const [productImageExisting, setProductImageExisting] = useState<string | null>(null);
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

    // Handle flash new_product_id(s) -> open setup modal
    useEffect(() => {
        const id = props.flash?.new_product_id;
        const ids = props.flash?.new_product_ids;
        let matched: Product[] = [];
        if (id && category?.products) {
            const p = category.products.find((x) => x.id === Number(id));
            if (p) matched = [p];
            else {
                // If product not in current list yet (maybe reload needed), still create placeholder?
                // But controller returns products reload, so should be in list.
            }
        }
        if (ids && Array.isArray(ids) && category?.products) {
            matched = category.products.filter((x) => ids.map(Number).includes(x.id));
        }
        if (matched.length > 0) {
            setNewProducts(matched);
            setShowSetup(true);
        }
    }, [props.flash?.new_product_id, props.flash?.new_product_ids, category?.products]);

    const filteredProducts = useMemo(() => {
        if (!category?.products) return [];
        let list = [...category.products];

        if (search) {
            const q = search.toLowerCase();
            list = list.filter((p) =>
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
                list = list.filter((p) => p.center_stock > 0 && p.center_stock <= 5);
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
    }, [category?.products, search, productFilter]);

    const handleCatUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setCatProcessing(true);
        const fd = new FormData();
        fd.append('name', catForm.name);
        if (catForm.brand) fd.append('brand', catForm.brand);
        if (catForm.description) fd.append('description', catForm.description);
        fd.append('is_active', catForm.is_active ? '1' : '0');
        if (catImageFile) fd.append('image', catImageFile);
        fd.append('_method', 'PUT');

        router.post(`/owner/product-categories/${category.id}`, fd, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Kategori berhasil diperbarui');
                setShowCatEdit(false);
            },
            onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
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
            onError: () => toast.error('Gagal menghapus kategori dengan produk'),
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
        setProductImageExisting(p.image ?? null);
        setProductImageFile(null);
        setShowProductForm(true);
    };

    const handleProductSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setProductProcessing(true);
        const fd = new FormData();
        fd.append('name', productForm.name);
        if (productForm.flavor) fd.append('flavor', productForm.flavor);
        if (productForm.size) fd.append('size', productForm.size);
        if (productForm.sku) fd.append('sku', productForm.sku);
        fd.append('center_price', productForm.center_price);
        fd.append('selling_price', productForm.selling_price);
        if (productForm.description) fd.append('description', productForm.description);
        fd.append('is_active', productForm.is_active ? '1' : '0');
        if (productImageFile) fd.append('image', productImageFile);

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
                onError: (err) => toast.error(Object.values(err).flat().join(', ')),
                onFinish: () => setProductProcessing(false),
            });
        } else {
            router.post(`/owner/product-categories/${category.id}/products`, fd, {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Produk berhasil dibuat');
                    setShowProductForm(false);
                },
                onError: (err) => toast.error(Object.values(err).flat().join(', ')),
                onFinish: () => setProductProcessing(false),
            });
        }
    };

    const handleBulkSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const flavors = bulkForm.flavorsText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        if (flavors.length === 0) {
            toast.error('Isi minimal 1 rasa');
            return;
        }
        setBulkProcessing(true);
        router.post(`/owner/product-categories/${category.id}/products/bulk`, {
            flavors,
            size: bulkForm.size || null,
            center_price: Number(bulkForm.center_price),
            selling_price: Number(bulkForm.selling_price),
            description: bulkForm.description || null,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`${flavors.length} produk berhasil dibuat`);
                setShowBulkForm(false);
                setBulkForm({ flavorsText: '', size: '', center_price: '', selling_price: '', description: '' });
            },
            onError: (err) => toast.error(Object.values(err).flat().join(', ')),
            onFinish: () => setBulkProcessing(false),
        });
    };

    const handleDeleteProduct = () => {
        if (!deleteId) return;
        router.delete(`/owner/products/${deleteId}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Produk berhasil dihapus');
                setDeleteId(null);
            },
            onError: (errors) => {
                const errMsg = Object.values(errors).flat().join(', ');
                if (errMsg.toLowerCase().includes('riwayat') || errMsg.toLowerCase().includes('stok')) {
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
        if (!softDeleteId) return;
        router.patch(`/owner/products/${softDeleteId}/toggle`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Produk dinonaktifkan');
                setSoftDeleteDialog(false);
                setSoftDeleteId(null);
            },
            onError: () => toast.error('Gagal menonaktifkan produk'),
        });
    };

    const handleDuplicate = (p: Product) => {
        router.post(`/owner/products/${p.id}/duplicate`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Produk berhasil duplikasi, setup stok');
                // flash will trigger modal via useEffect
            },
            onError: () => toast.error('Gagal menduplikasi produk'),
        });
    };

    const handleToggle = (p: Product) => {
        router.patch(`/owner/products/${p.id}/toggle`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success(p.is_active ? 'Produk dinonaktifkan' : 'Produk diaktifkan'),
            onError: () => toast.error('Gagal mengubah status'),
        });
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
            subtitle={category.brand ? `${category.brand}` : 'Detail kategori'}
            backHref="/owner/product-categories"
            headerRight={
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setShowCatEdit(true)}>
                        <Pencil className="mr-1 h-4 w-4" /> Edit Kategori
                    </Button>
                    <Button variant="danger" onClick={() => setDeleteCatDialog(true)}>
                        <Trash2 className="mr-1 h-4 w-4" /> Hapus
                    </Button>
                </div>
            }
        >
            {category.description && (
                <div className="mb-4 rounded-xl bg-surface p-4 shadow-card ring-1 ring-border/20">
                    <p className="text-sm text-slate-600">{category.description}</p>
                </div>
            )}

            <ProductSearchFilters search={search} onSearch={setSearch} filter={productFilter} onFilterChange={setProductFilter} />

            <div className="mb-4 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setShowBulkForm(true)}>
                    <Layers className="mr-1 h-4 w-4" /> Tambah Multi Rasa
                </Button>
                <Button onClick={openCreateProduct}>
                    <Plus className="mr-1 h-4 w-4" /> Tambah Produk
                </Button>
            </div>

            {filteredProducts.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-slate-400" />}
                    title={category.products?.length === 0 ? 'Belum ada produk' : 'Tidak ditemukan'}
                    description={category.products?.length === 0 ? 'Tambah produk pertama' : 'Coba kata kunci lain'}
                    action={category.products?.length === 0 ? { label: 'Tambah Produk', onClick: openCreateProduct } : undefined}
                />
            ) : (
                <div className="overflow-x-auto rounded-xl bg-surface shadow-card ring-1 ring-border/20">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-surface-muted/50 text-left">
                                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase">Produk</th>
                                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase">Rasa</th>
                                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase">Ukuran</th>
                                <th className="px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase">SKU</th>
                                <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase">HPP</th>
                                <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase">Hrg Jual</th>
                                <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase">Margin%</th>
                                <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase">Stok Pusat</th>
                                <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-text-muted uppercase">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredProducts.map((p) => {
                                const margin = Number(p.selling_price) - Number(p.center_price);
                                const marginPct = Number(p.center_price) > 0 ? (margin / Number(p.center_price)) * 100 : 0;
                                const hasNoStock = p.center_stock === 0;
                                return (
                                    <tr key={p.id} className={`hover:bg-mint-wash/30 transition ${!p.is_active ? 'opacity-60' : ''}`}>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <ProductImage name={p.name} src={p.image} categoryImage={category.image} size="sm" />
                                                <div className="min-w-0">
                                                    <div className="max-w-[200px] truncate font-semibold text-text">{category.name} - {p.name}</div>
                                                    <div className="mt-0.5 flex items-center gap-1.5">
                                                        {!p.is_active && <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-muted">NONAKTIF</span>}
                                                        {!p.image && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 ring-1 ring-amber-200">No Image</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-text-muted">{p.flavor || '-'}</td>
                                        <td className="px-3 py-3 text-text-muted">{p.size || '-'}</td>
                                        <td className="px-3 py-3 text-xs font-mono text-text-muted">{p.sku || '-'}</td>
                                        <td className="px-3 py-3 text-right tabular-nums text-text-muted">{formatCurrency(p.center_price)}</td>
                                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-text">{formatCurrency(p.selling_price)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">
                                            <span className={marginPct < 20 ? 'text-amber-600' : 'text-emerald-700'}>{marginPct.toFixed(1)}%</span>
                                            <span className="ml-1 text-[11px] text-text-subtle">({formatCurrency(margin)})</span>
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums">
                                            {hasNoStock ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                                                    0
                                                    <span className="ml-1 rounded bg-red-100 px-1 py-0 text-[9px]">No Center Stock</span>
                                                </span>
                                            ) : (
                                                <span className={p.center_stock <=5 ? 'text-amber-600 font-bold' : 'text-text'}>{p.center_stock}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <button title="Duplikat" onClick={() => handleDuplicate(p)} className="rounded p-1 text-text-subtle hover:bg-mint-wash hover:text-text">
                                                    <Copy className="h-3.5 w-3.5" />
                                                </button>
                                                <button title={p.is_active ? 'Nonaktifkan' : 'Aktifkan'} onClick={() => handleToggle(p)} className="rounded p-1 text-text-subtle hover:bg-mint-wash hover:text-text">
                                                    {p.is_active ? <ToggleRight className="h-3.5 w-3.5 text-primary" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                                </button>
                                                <button title="Edit" onClick={() => openEditProduct(p)} className="rounded p-1 text-text-subtle hover:bg-mint-wash hover:text-text">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button title="Hapus" onClick={() => setDeleteId(p.id)} className="rounded p-1 text-text-subtle hover:bg-red-50 hover:text-red-600">
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

            {/* Category Edit Dialog */}
            <Dialog open={showCatEdit} onOpenChange={(o) => !o && setShowCatEdit(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Kategori: {category.name}</DialogTitle>
                        <DialogDescription>Perbarui kategori produk.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCatUpdate} className="space-y-3">
                        <Input label="Nama Kategori" value={catForm.name} onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))} required />
                        <Input label="Brand" value={catForm.brand} onChange={(e) => setCatForm((p) => ({ ...p, brand: e.target.value }))} />
                        <Textarea label="Deskripsi" value={catForm.description} onChange={(e) => setCatForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
                        <ImageUploadField value={catImageFile ? catImageFile : catImageExisting} onChange={(f) => { setCatImageFile(f); if (f===null) setCatImageExisting(null); }} label="Foto Kategori" />
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={catForm.is_active} onChange={(e) => setCatForm((p) => ({ ...p, is_active: e.target.checked }))} className="rounded" />
                            <span className="text-sm">Aktif</span>
                        </label>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowCatEdit(false)}>Batal</Button>
                            <Button type="submit" disabled={catProcessing}>{catProcessing ? 'Menyimpan...' : 'Update'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Product Form Dialog */}
            <Dialog open={showProductForm} onOpenChange={(o) => { if (!o) { setShowProductForm(false); setEditingProduct(null);} }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</DialogTitle>
                        <DialogDescription>{editingProduct ? `Perbarui ${editingProduct.name}` : `Tambah produk ke kategori ${category.name}`}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleProductSubmit} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Nama Produk" value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Original 200ml" />
                            <Input label="SKU (auto jika kosong)" value={productForm.sku} onChange={(e) => setProductForm((p) => ({ ...p, sku: e.target.value }))} placeholder="AUTO" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Rasa" value={productForm.flavor} onChange={(e) => setProductForm((p) => ({ ...p, flavor: e.target.value }))} placeholder="Coklat" />
                            <Input label="Ukuran" value={productForm.size} onChange={(e) => setProductForm((p) => ({ ...p, size: e.target.value }))} placeholder="200ml" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="HPP (Rp)" type="number" value={productForm.center_price} onChange={(e) => setProductForm((p) => ({ ...p, center_price: e.target.value }))} required min={0} />
                            <Input label="Harga Jual (Rp)" type="number" value={productForm.selling_price} onChange={(e) => setProductForm((p) => ({ ...p, selling_price: e.target.value }))} required min={0} />
                        </div>
                        <Textarea label="Deskripsi" value={productForm.description} onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
                        <ImageUploadField value={productImageFile ? productImageFile : productImageExisting} onChange={(f) => { setProductImageFile(f); if (f===null) setProductImageExisting(null); }} label="Foto Produk" />
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={productForm.is_active} onChange={(e) => setProductForm((p) => ({ ...p, is_active: e.target.checked }))} className="rounded" />
                            <span className="text-sm">Aktif</span>
                        </label>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setShowProductForm(false); setEditingProduct(null); }}>Batal</Button>
                            <Button type="submit" disabled={productProcessing}>{productProcessing ? 'Menyimpan...' : editingProduct ? 'Update' : 'Simpan'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Bulk Form Dialog */}
            <Dialog open={showBulkForm} onOpenChange={(o) => !o && setShowBulkForm(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tambah Multi Rasa</DialogTitle>
                        <DialogDescription>Buat banyak varian rasa sekaligus dalam kategori {category.name}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleBulkSubmit} className="space-y-3">
                        <Textarea label="Daftar Rasa (pisah koma atau baris baru)" value={bulkForm.flavorsText} onChange={(e) => setBulkForm((p) => ({ ...p, flavorsText: e.target.value }))} required placeholder="Coklat, Vanilla, Stroberi" rows={3} />
                        <Input label="Ukuran (opsional)" value={bulkForm.size} onChange={(e) => setBulkForm((p) => ({ ...p, size: e.target.value }))} placeholder="200ml" />
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="HPP (Rp)" type="number" value={bulkForm.center_price} onChange={(e) => setBulkForm((p) => ({ ...p, center_price: e.target.value }))} required min={0} />
                            <Input label="Harga Jual (Rp)" type="number" value={bulkForm.selling_price} onChange={(e) => setBulkForm((p) => ({ ...p, selling_price: e.target.value }))} required min={0} />
                        </div>
                        <Textarea label="Deskripsi (opsional)" value={bulkForm.description} onChange={(e) => setBulkForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowBulkForm(false)}>Batal</Button>
                            <Button type="submit" disabled={bulkProcessing}>{bulkProcessing ? 'Membuat...' : 'Buat'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Product */}
            <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Produk</DialogTitle>
                        <DialogDescription>
                            Yakin ingin menghapus produk ini? Produk dengan riwayat transaksi tidak dapat dihapus (soft delete guard).
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
                        <Button variant="destructive" onClick={handleDeleteProduct}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Soft Delete Guard → Deactivate Dialog */}
            <Dialog open={softDeleteDialog} onOpenChange={(o) => { if (!o) { setSoftDeleteDialog(false); setSoftDeleteId(null); }}}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tidak Bisa Hapus</DialogTitle>
                        <DialogDescription>
                            Tidak bisa hapus, produk sudah dipakai di pesanan. Nonaktifkan saja?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setSoftDeleteDialog(false); setSoftDeleteId(null); }}>Batal</Button>
                        <Button variant="default" onClick={handleSoftDeleteDeactivate}>Deactivate</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Category */}
            <Dialog open={deleteCatDialog} onOpenChange={setDeleteCatDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Kategori</DialogTitle>
                        <DialogDescription>Semua produk harus dihapus terlebih dahulu. Yakin hapus kategori {category.name}?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteCatDialog(false)}>Batal</Button>
                        <Button variant="destructive" onClick={handleDeleteCategory}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <SetupCenterStockModal products={newProducts} open={showSetup} onClose={() => { setShowSetup(false); setNewProducts([]); }} />
        </OwnerPageShell>
    );
}
