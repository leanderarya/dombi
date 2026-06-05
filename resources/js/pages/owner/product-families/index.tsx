import { Head, Link, useForm } from '@inertiajs/react';
import { useState } from 'react';

interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    sku: string | null;
    center_price: number;
    selling_price: number;
    is_active: boolean;
    order_items_count: number;
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
    const [showForm, setShowForm] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        brand: '',
        description: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/owner/product-families', {
            onSuccess: () => {
                reset();
                setShowForm(false);
            },
        });
    };

    return (
        <>
            <Head title="Product Families" />

            <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-lg font-bold text-slate-900">Product Families</h1>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                        {showForm ? 'Batal' : 'Tambah'}
                    </button>
                </div>

                {/* Create Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="space-y-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Nama Family</label>
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="Domilk Premium Taste"
                                />
                                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Brand</label>
                                <input
                                    type="text"
                                    value={data.brand}
                                    onChange={(e) => setData('brand', e.target.value)}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="Domilk"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Deskripsi</label>
                                <textarea
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    rows={2}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                Simpan
                            </button>
                        </div>
                    </form>
                )}

                {/* Family List */}
                <div className="space-y-3">
                    {families.map((family) => (
                        <Link
                            key={family.id}
                            href={`/owner/product-families/${family.id}`}
                            className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-emerald-300"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">{family.name}</div>
                                    {family.brand && (
                                        <div className="text-xs text-zinc-500">{family.brand}</div>
                                    )}
                                    {family.description && (
                                        <div className="mt-1 text-xs text-zinc-400 line-clamp-2">{family.description}</div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-emerald-700">{family.variants_count}</div>
                                    <div className="text-xs text-zinc-400">variants</div>
                                </div>
                            </div>

                            {/* Variant Preview */}
                            {family.variants.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1">
                                    {family.variants.slice(0, 4).map((v) => (
                                        <span
                                            key={v.id}
                                            className={`rounded-full px-2 py-0.5 text-xs ${
                                                v.is_active
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-zinc-100 text-zinc-400'
                                            }`}
                                        >
                                            {v.name}
                                        </span>
                                    ))}
                                    {family.variants.length > 4 && (
                                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                                            +{family.variants.length - 4}
                                        </span>
                                    )}
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            </div>
        </>
    );
}
