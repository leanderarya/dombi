import { Head, router, useForm } from '@inertiajs/react';
import { Package, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';

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

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        brand: '',
        description: '',
    });

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

    const handleDelete = (id: number) => {
        if (confirm('Hapus product family ini?')) {
            router.delete(`/owner/product-families/${id}`);
        }
    };

    return (
        <OwnerPageShell
            title="Product Families"
            subtitle="Kelola kelompok produk dan variant"
            headerRight={
                <button
                    onClick={() => {
                        reset();
                        setEditingId(null);
                        setShowForm(!showForm);
                    }}
                    className="flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
                >
                    <Plus className="mr-1 h-4 w-4" />
                    {showForm ? 'Batal' : 'Tambah'}
                </button>
            }
        >
            <Head title="Product Families" />

            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari product family..."
                        className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-4 text-sm"
                    />
                </div>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-border bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-text">
                        {editingId ? 'Edit Product Family' : 'Tambah Product Family'}
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Nama</label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                required
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                                placeholder="Domilk Premium"
                            />
                            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Brand</label>
                            <input
                                type="text"
                                value={data.brand}
                                onChange={(e) => setData('brand', e.target.value)}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                                placeholder="Domilk"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Deskripsi</label>
                            <textarea
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                rows={2}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                                placeholder="Deskripsi produk..."
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                            {processing ? 'Menyimpan...' : editingId ? 'Update' : 'Simpan'}
                        </button>
                    </div>
                </form>
            )}

            {/* Family List */}
            {filteredFamilies.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title={search ? 'Tidak ditemukan' : 'Belum ada product family'}
                    description={search ? 'Coba kata kunci lain' : 'Tambah product family pertama Anda'}
                />
            ) : (
                <div className="space-y-2">
                    {filteredFamilies.map((family) => (
                        <div key={family.id} className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm">
                            {/* Row 1: name + badge + count + actions */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-text">{family.name}</span>
                                    {!family.is_active && (
                                        <StatusBadge variant="neutral" size="sm">Nonaktif</StatusBadge>
                                    )}
                                    <span className="text-xs text-text-muted">{family.variants_count} variant</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handleEdit(family)} className="rounded-lg p-1.5 text-text-subtle hover:bg-surface-muted hover:text-text-muted">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(family.id)} className="rounded-lg p-1.5 text-text-subtle hover:bg-red-50 hover:text-red-600">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Row 2: meta + variants + link */}
                            <div className="mt-1.5 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs text-text-muted">
                                        {[family.brand, family.description].filter(Boolean).join(' · ') || '-'}
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {family.variants.slice(0, 4).map((v) => (
                                            <span
                                                key={v.id}
                                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                                    v.is_active ? 'bg-primary-light text-primary' : 'bg-surface-muted text-text-muted'
                                                }`}
                                            >
                                                {v.name}
                                            </span>
                                        ))}
                                        {family.variants_count > 4 && (
                                            <span className="inline-flex rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">
                                                +{family.variants_count - 4}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.get(`/owner/product-families/${family.id}`)}
                                    className="ml-3 shrink-0 text-xs font-semibold text-primary hover:text-primary/80"
                                >
                                    Kelola →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </OwnerPageShell>
    );
}
