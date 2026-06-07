import { Head, Link, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import { formatCurrency } from '@/lib/format';

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
    const [showVariantForm, setShowVariantForm] = useState(false);
    const [editingVariant, setEditingVariant] = useState<Variant | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        flavor: '',
        size: '',
        sku: '',
        center_price: '',
        selling_price: '',
        center_stock: '',
        is_active: true,
    });

    const handleCreateVariant = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/owner/product-families/${family.id}/variants`, {
            onSuccess: () => {
                reset();
                setShowVariantForm(false);
            },
        });
    };

    const handleUpdateVariant = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVariant) return;
        put(`/owner/variants/${editingVariant.id}`, {
            onSuccess: () => {
                reset();
                setEditingVariant(null);
            },
        });
    };

    const startEdit = (variant: Variant) => {
        setEditingVariant(variant);
        setData({
            name: variant.name,
            flavor: variant.flavor ?? '',
            size: variant.size ?? '',
            sku: variant.sku ?? '',
            center_price: String(variant.center_price),
            selling_price: String(variant.selling_price),
            center_stock: String(variant.center_stock),
            is_active: variant.is_active,
        });
    };

    return (
        <>
            <Head title={family.name} />

            <div className="p-4">
                {/* Header */}
                <div className="mb-4">
                    <Link href="/owner/product-families" className="text-xs text-emerald-600 hover:text-emerald-700">
                        ← Kembali
                    </Link>
                    <h1 className="mt-1 text-lg font-bold text-slate-900">{family.name}</h1>
                    {family.brand && <div className="text-sm text-zinc-500">{family.brand}</div>}
                    {family.description && <div className="mt-1 text-sm text-zinc-400">{family.description}</div>}
                </div>

                {/* Add Variant Button */}
                <div className="mb-4">
                    <button
                        onClick={() => { setShowVariantForm(!showVariantForm); setEditingVariant(null); reset(); }}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                        {showVariantForm ? 'Batal' : 'Tambah Variant'}
                    </button>
                </div>

                {/* Variant Form */}
                {(showVariantForm || editingVariant) && (
                    <form
                        onSubmit={editingVariant ? handleUpdateVariant : handleCreateVariant}
                        className="mb-4 rounded-xl border border-zinc-200 bg-white p-4"
                    >
                        <h2 className="mb-3 text-sm font-semibold text-slate-900">
                            {editingVariant ? 'Edit Variant' : 'Tambah Variant'}
                        </h2>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-zinc-500">Rasa</label>
                                    <input
                                        type="text"
                                        value={data.flavor}
                                        onChange={(e) => setData('flavor', e.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                        placeholder="Coklat"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-zinc-500">Ukuran</label>
                                    <input
                                        type="text"
                                        value={data.size}
                                        onChange={(e) => setData('size', e.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                        placeholder="250ml"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Nama Variant</label>
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="Coklat 250ml"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">SKU</label>
                                <input
                                    type="text"
                                    value={data.sku}
                                    onChange={(e) => setData('sku', e.target.value)}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="DOM-COK-250ML"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-zinc-500">Harga Center (Rp)</label>
                                    <input
                                        type="number"
                                        value={data.center_price}
                                        onChange={(e) => setData('center_price', e.target.value)}
                                        required
                                        min="0"
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-zinc-500">Harga Jual (Rp)</label>
                                    <input
                                        type="number"
                                        value={data.selling_price}
                                        onChange={(e) => setData('selling_price', e.target.value)}
                                        required
                                        min="0"
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Stok Pusat</label>
                                <input
                                    type="number"
                                    value={data.center_stock}
                                    onChange={(e) => setData('center_stock', e.target.value)}
                                    required
                                    min="0"
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                />
                            </div>
                            {editingVariant && (
                                <div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={data.is_active}
                                            onChange={(e) => setData('is_active', e.target.checked)}
                                            className="rounded border-zinc-300"
                                        />
                                        <span className="text-sm text-zinc-700">Aktif</span>
                                    </label>
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {editingVariant ? 'Update' : 'Simpan'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Variants List */}
                <div className="space-y-2">
                    {family.variants.length === 0 ? (
                        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
                            <p className="text-sm text-zinc-500">Belum ada variant</p>
                        </div>
                    ) : (
                        family.variants.map((variant) => (
                            <div
                                key={variant.id}
                                className={`rounded-xl border bg-white p-4 ${
                                    variant.is_active ? 'border-zinc-200' : 'border-zinc-100 opacity-60'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">{variant.name}</div>
                                        {variant.sku && (
                                            <div className="text-xs text-zinc-400">SKU: {variant.sku}</div>
                                        )}
                                        <div className="mt-1 flex gap-4 text-xs text-zinc-500">
                                            <span>Center: {formatCurrency(variant.center_price)}</span>
                                            <span>Jual: {formatCurrency(variant.selling_price)}</span>
                                            <span>Stok Pusat: {variant.center_stock}</span>
                                            <span className="text-emerald-600">
                                                Margin: {formatCurrency(variant.selling_price - variant.center_price)}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-400">
                                            {variant.order_items_count} pesanan
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => startEdit(variant)}
                                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
