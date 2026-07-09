import { router, useForm } from '@inertiajs/react';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
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
    is_active: boolean;
    variants_count: number;
    variants: Variant[];
}

interface Props {
    families: Family[];
}

export default function ProductFamiliesIndex({ families }: Props) {
    const [search, setSearch] = useState('');
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
            <OwnerPageShell title="Product Families" subtitle="Kelola kelompok produk dan variant">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const filteredFamilies = families.filter((f) => {
        if (!search) {
            return true;
        }

        const q = search.toLowerCase();

        return f.name.toLowerCase().includes(q) || (f.brand?.toLowerCase().includes(q) ?? false);
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
            title="Product Families"
            subtitle="Kelola kelompok produk dan variant"
            headerRight={
                <Button onClick={() => {
 reset(); setEditingId(null); setShowForm(true); 
}}>
                    <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                    Tambah
                </Button>
            }
        >
            <OwnerFilterCard
                searchPlaceholder="Cari product family..."
                searchValue={search}
                onSearch={setSearch}
            />

            {filteredFamilies.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title={search ? 'Tidak ditemukan' : 'Belum ada product family'}
                    description={search ? 'Coba kata kunci lain' : 'Tambah product family pertama Anda'}
                />
            ) : (
                <div className="space-y-2" aria-label="Daftar Product Family">
                    {filteredFamilies.map((family) => (
                        <div key={family.id} className="rounded-lg border border-border bg-white p-4 transition-all duration-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-text">{family.name}</span>
                                    {!family.is_active && (
                                        <StatusBadge variant="neutral" size="sm">Nonaktif</StatusBadge>
                                    )}
                                    <span className="text-xs text-text-muted">{family.variants_count} variant</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" aria-label={`Edit ${family.name}`} onClick={() => handleEdit(family)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label={`Hapus ${family.name}`} onClick={() => setDeleteId(family.id)}>
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-1.5 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs text-text-muted">
                                        {[family.brand, family.description].filter(Boolean).join(' · ') || '-'}
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {family.variants.slice(0, 4).map((v) => (
                                            <span
                                                key={v.id}
                                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    v.is_active ? 'bg-primary-light text-primary' : 'bg-surface-muted text-text-muted'
                                                }`}
                                            >
                                                {v.name}
                                            </span>
                                        ))}
                                        {family.variants_count > 4 && (
                                            <span className="inline-flex rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
                                                +{family.variants_count - 4}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => router.get(`/owner/product-families/${family.id}`)}
                                    className="ml-3 shrink-0"
                                >
                                    Kelola →
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Product Family' : 'Tambah Product Family'}</DialogTitle>
                        <DialogDescription>{editingId ? 'Perbarui data product family.' : 'Tambah product family baru.'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-3">
                            <Input
                                label="Nama"
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                required
                                error={errors.name}
                                placeholder="Domilk Premium"
                            />
                            <Input
                                label="Brand"
                                type="text"
                                value={data.brand}
                                onChange={(e) => setData('brand', e.target.value)}
                                placeholder="Domilk"
                            />
                            <Textarea
                                label="Deskripsi"
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                rows={2}
                                placeholder="Deskripsi produk..."
                            />
                        </div>
                    </form>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={processing}>
                            {editingId ? 'Update' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Product Family</DialogTitle>
                        <DialogDescription>Yakin ingin menghapus product family ini? Tindakan ini tidak dapat dibatalkan.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
                        <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
