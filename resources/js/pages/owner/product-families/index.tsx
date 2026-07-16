import { router, useForm } from '@inertiajs/react';
import { Package, Pencil, Plus, Trash2, ChevronRight } from 'lucide-react';
import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';

interface Variant {
    id: number;
    name: string;
    is_active: boolean;
}

interface Family {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    image: string | null;
    is_active: boolean;
    variants_count: number;
    variants: Variant[];
}

interface Props {
    families: Family[];
}

const statusFilters = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Aktif' },
    { key: 'inactive', label: 'Nonaktif' },
] as const;

type FilterKey = (typeof statusFilters)[number]['key'];

export default function ProductFamiliesIndex({ families }: Props) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        brand: '',
        description: '',
    });

    if (families === undefined || families === null) {
        return (
            <OwnerPageShell
                title="Produk"
                subtitle="Kelola kelompok produk dan variant susu kambing Anda"
            >
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const filteredFamilies = families.filter((f) => {
        if (statusFilter === 'active' && !f.is_active) {
            return false;
        }

        if (statusFilter === 'inactive' && f.is_active) {
            return false;
        }

        if (!search) {
            return true;
        }

        const q = search.toLowerCase();

        return (
            f.name.toLowerCase().includes(q) ||
            (f.brand?.toLowerCase().includes(q) ?? false)
        );
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingId) {
            put(`/owner/product-families/${editingId}`, {
                onSuccess: () => {
                    reset();
                    setShowForm(false);
                    setEditingId(null);
                },
            });
        } else {
            post('/owner/product-families', {
                onSuccess: () => {
                    reset();
                    setShowForm(false);
                },
            });
        }
    };

    const handleEdit = (family: Family) => {
        setEditingId(family.id);
        setData({
            name: family.name,
            brand: family.brand ?? '',
            description: family.description ?? '',
        });
        setShowForm(true);
    };

    const handleDelete = () => {
        if (deleteId) {
            router.delete(`/owner/product-families/${deleteId}`, {
                onSuccess: () => setDeleteId(null),
            });
        }
    };

    return (
        <OwnerPageShell
            title="Produk"
            subtitle="Kelola kelompok produk dan variant susu kambing Anda"
            headerRight={
                <Button
                    onClick={() => {
                        reset();
                        setEditingId(null);
                        setShowForm(true);
                    }}
                >
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                    Tambah Produk
                </Button>
            }
        >
            {/* Search + Filter Chips */}
            <div className="mb-6 flex items-center gap-3">
                <Input
                    type="text"
                    placeholder="Cari produk..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64"
                />
                <div className="flex items-center gap-2">
                    {statusFilters.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setStatusFilter(f.key)}
                            className={`rounded-full px-4 py-1.5 text-[12px] font-medium transition-all ${
                                statusFilter === f.key
                                    ? 'bg-primary text-white'
                                    : 'bg-surface-container hover:bg-mint-wash text-text-muted'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {filteredFamilies.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title={
                        search || statusFilter !== 'all'
                            ? 'Tidak ditemukan'
                            : 'Belum ada produk'
                    }
                    description={
                        search || statusFilter !== 'all'
                            ? 'Coba kata kunci atau filter lain'
                            : 'Tambah produk pertama Anda'
                    }
                />
            ) : (
                <div
                    className="overflow-hidden rounded-xl bg-surface shadow-card"
                    aria-label="Daftar Product Family"
                >
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-border/30 bg-surface-muted/50">
                                <th className="px-6 py-4 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                    Produk
                                </th>
                                <th className="px-6 py-4 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                    Gambar
                                </th>
                                <th className="px-6 py-4 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                    Merek
                                </th>
                                <th className="px-6 py-4 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                    Varian
                                </th>
                                <th className="px-6 py-4 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-right text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {filteredFamilies.map((family) => (
                                <tr
                                    key={family.id}
                                    className="hover:bg-mint-wash group transition-colors"
                                >
                                    {/* Produk */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-mint-wash flex h-8 w-8 items-center justify-center rounded-lg text-primary">
                                                <Package className="h-4 w-4" />
                                            </div>
                                            <span className="text-sm font-semibold text-text">
                                                {family.name}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Gambar */}
                                    <td className="px-6 py-4">
                                        {family.image ? (
                                            <img
                                                src={`/storage/${family.image}`}
                                                alt={family.name}
                                                className="h-10 w-10 rounded object-cover"
                                            />
                                        ) : (
                                            <span className="text-xs text-text-muted">
                                                —
                                            </span>
                                        )}
                                    </td>

                                    {/* Merek */}
                                    <td className="px-6 py-4 text-sm text-text-muted">
                                        {family.brand || '-'}
                                    </td>

                                    {/* Varian */}
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {family.variants
                                                .slice(0, 3)
                                                .map((v) => (
                                                    <span
                                                        key={v.id}
                                                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                                                            v.is_active
                                                                ? 'border border-primary/10 bg-white text-primary'
                                                                : 'bg-surface-muted text-text-muted'
                                                        }`}
                                                    >
                                                        {v.name}
                                                    </span>
                                                ))}
                                            {family.variants_count > 3 && (
                                                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-text-muted">
                                                    +{family.variants_count - 3}{' '}
                                                    lagi
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Status */}
                                    <td className="px-6 py-4">
                                        {family.is_active ? (
                                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                                                AKTIF
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-text-muted">
                                                NONAKTIF
                                            </span>
                                        )}
                                    </td>

                                    {/* Aksi */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() =>
                                                    router.get(
                                                        `/owner/product-families/${family.id}`,
                                                    )
                                                }
                                                className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
                                            >
                                                Kelola{' '}
                                                <ChevronRight className="h-3 w-3" />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleEdit(family)
                                                }
                                                className="p-1.5 text-text-muted transition-colors hover:text-primary"
                                                aria-label={`Edit ${family.name}`}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setDeleteId(family.id)
                                                }
                                                className="p-1.5 text-text-muted transition-colors hover:text-red-600"
                                                aria-label={`Hapus ${family.name}`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? 'Edit Produk' : 'Tambah Produk'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingId
                                ? 'Perbarui data produk.'
                                : 'Tambah produk baru.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-3">
                            <Input
                                label="Nama"
                                type="text"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                required
                                error={errors.name}
                                placeholder="Dombi Classic"
                            />
                            <Input
                                label="Brand"
                                type="text"
                                value={data.brand}
                                onChange={(e) =>
                                    setData('brand', e.target.value)
                                }
                                placeholder="Dombi"
                            />
                            <Textarea
                                label="Deskripsi"
                                value={data.description}
                                onChange={(e) =>
                                    setData('description', e.target.value)
                                }
                                rows={2}
                                placeholder="Deskripsi produk..."
                            />
                        </div>
                    </form>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowForm(false)}
                        >
                            Batal
                        </Button>
                        <Button onClick={handleSubmit} disabled={processing}>
                            {editingId ? 'Update' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={deleteId !== null}
                onOpenChange={() => setDeleteId(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Produk</DialogTitle>
                        <DialogDescription>
                            Yakin ingin menghapus produk ini? Tindakan ini tidak
                            dapat dibatalkan.
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
