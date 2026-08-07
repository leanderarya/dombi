import { router } from '@inertiajs/react';
import { Package, Pencil, Plus, Trash2, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerTable from '@/components/owner/owner-table';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { ProductCategory } from '@/types/product';

interface Props {
    categories: ProductCategory[];
}

const statusFilters = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Aktif' },
    { key: 'inactive', label: 'Nonaktif' },
] as const;

type FilterKey = (typeof statusFilters)[number]['key'];

interface FormData {
    name: string;
    description: string;
    is_active: boolean;
}

export default function ProductCategoriesIndex({ categories }: Props) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);

    const [form, setForm] = useState<FormData>({
        name: '',
        description: '',
        is_active: true,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const filtered = useMemo(() => {
        if (!categories) {
            return [];
        }

        return categories.filter((c) => {
            if (statusFilter === 'active' && !c.is_active) {
                return false;
            }

            if (statusFilter === 'inactive' && c.is_active) {
                return false;
            }

            if (search) {
                const q = search.toLowerCase();

                return c.name.toLowerCase().includes(q);
            }

            return true;
        });
    }, [categories, search, statusFilter]);

    const resetForm = () => {
        setForm({ name: '', description: '', is_active: true });
        setErrors({});
        setEditingId(null);
    };

    const handleEdit = (cat: ProductCategory) => {
        setEditingId(cat.id);
        setForm({
            name: cat.name,
            description: cat.description ?? '',
            is_active: cat.is_active,
        });
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        const fd = new FormData();
        fd.append('name', form.name);

        if (form.description) {
            fd.append('description', form.description);
        }

        fd.append('is_active', form.is_active ? '1' : '0');

        // For update, spoof PUT
        if (editingId) {
            fd.append('_method', 'PUT');
        }

        const url = editingId
            ? `/owner/product-categories/${editingId}`
            : '/owner/product-categories';

        router.post(url, fd, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success(
                    editingId
                        ? 'Kategori berhasil diperbarui'
                        : 'Kategori berhasil ditambahkan',
                );
                setShowForm(false);
                resetForm();
            },
            onError: (errs: Record<string, string>) => {
                setErrors(errs);
                toast.error(Object.values(errs).flat().join(', '));
            },
            onFinish: () => setProcessing(false),
        });
    };

    const handleDelete = () => {
        if (!deleteId) {
            return;
        }

        router.delete(`/owner/product-categories/${deleteId}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Kategori berhasil dihapus');
                setDeleteId(null);
            },
            onError: () =>
                toast.error(
                    'Gagal menghapus - pastikan kategori tidak memiliki produk',
                ),
        });
    };

    return (
        <OwnerPageShell
            title="Kategori Produk"
            subtitle="Kelola kategori produk dan variannya"
            headerRight={
                <Button
                    onClick={() => {
                        resetForm();
                        setShowForm(true);
                    }}
                >
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                    Tambah Kategori
                </Button>
            }
        >
            {/* Search + Filter Chips */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Cari kategori..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 pl-10 text-sm transition-colors outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <Package className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
                </div>
                <div className="flex flex-wrap gap-2">
                    {statusFilters.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setStatusFilter(f.key)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                statusFilter === f.key
                                    ? 'bg-primary/10 text-primary ring-primary/20'
                                    : 'bg-surface text-text-muted ring-border hover:bg-mint-wash'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title={
                        search || statusFilter !== 'all'
                            ? 'Tidak ditemukan'
                            : 'Belum ada kategori'
                    }
                    description={
                        search || statusFilter !== 'all'
                            ? 'Coba kata kunci atau filter lain'
                            : 'Tambah kategori pertama Anda'
                    }
                />
            ) : (
                <div
                    className="overflow-hidden rounded-xl bg-surface shadow-xs ring-1 ring-foreground/10"
                    aria-label="Daftar Kategori Produk"
                >
                    <OwnerTable noWrapper>
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-border/30 bg-surface-muted/50">
                                    <TableHead className="px-6 py-4 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                        Kategori
                                    </TableHead>
                                    <TableHead className="px-6 py-4 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                        Produk
                                    </TableHead>
                                    <TableHead className="px-6 py-4 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                        Status
                                    </TableHead>
                                    <TableHead className="px-6 py-4 text-right text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                        Aksi
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-border/20">
                                {filtered.map((cat) => (
                                    <TableRow
                                        key={cat.id}
                                        className="group transition-colors hover:bg-mint-wash"
                                    >
                                        <TableCell className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint-wash text-primary">
                                                    <Package className="h-4 w-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-text">
                                                        {cat.name}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-text-muted">
                                                {cat.products_count ??
                                                    cat.products?.length ??
                                                    0}{' '}
                                                produk
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            {cat.is_active ? (
                                                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                                                    AKTIF
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-text-muted">
                                                    NONAKTIF
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() =>
                                                        router.get(
                                                            `/owner/product-categories/${cat.id}`,
                                                        )
                                                    }
                                                    className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
                                                >
                                                    Kelola{' '}
                                                    <ChevronRight className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleEdit(cat)
                                                    }
                                                    className="p-1.5 text-text-muted transition-colors hover:text-primary"
                                                    aria-label={`Edit ${cat.name}`}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setDeleteId(cat.id)
                                                    }
                                                    className="p-1.5 text-text-muted transition-colors hover:text-red-600"
                                                    aria-label={`Hapus ${cat.name}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </OwnerTable>
                </div>
            )}

            <Dialog
                open={showForm}
                onOpenChange={(o) => {
                    if (!o) {
                        setShowForm(false);
                        resetForm();
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? 'Edit Kategori' : 'Tambah Kategori'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingId
                                ? 'Perbarui data kategori.'
                                : 'Tambah kategori baru.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-3">
                            <Input
                                label="Nama Kategori"
                                type="text"
                                value={form.name}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        name: e.target.value,
                                    }))
                                }
                                required
                                error={errors.name}
                                placeholder="Biogoat"
                            />
                            <Textarea
                                label="Deskripsi"
                                value={form.description}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        description: e.target.value,
                                    }))
                                }
                                rows={2}
                                placeholder="Deskripsi kategori..."
                            />
                            <Checkbox
                                label="Aktif"
                                checked={form.is_active}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        is_active: e.target.checked,
                                    }))
                                }
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setShowForm(false);
                                    resetForm();
                                }}
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing
                                    ? 'Menyimpan...'
                                    : editingId
                                      ? 'Update'
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
                        <DialogTitle>Hapus Kategori</DialogTitle>
                        <DialogDescription>
                            Yakin ingin menghapus kategori ini? Kategori yang
                            masih memiliki produk tidak dapat dihapus.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteId(null)}
                        >
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
