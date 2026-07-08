import type { FormEventHandler } from 'react';
import type { InertiaFormProps } from '@inertiajs/react';

export const DEFAULT_MARKUP_PERCENT = 30;

interface Props {
    form: InertiaFormProps<{
        name: string;
        flavor: string;
        size: string;
        sku: string;
        center_price: string;
        selling_price: string;
        center_stock: string;
        is_active: boolean;
    }>;
    editing: boolean;
    onSubmit: FormEventHandler;
    onCancel: () => void;
}

export default function VariantForm({ form, editing, onSubmit, onCancel }: Props) {
    return (
        <form onSubmit={onSubmit} className="mb-4 rounded-lg border border-border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-text">
                {editing ? 'Edit Variant' : 'Tambah Variant'}
            </h2>
            <div className="space-y-3">
                {/* Required: Rasa + Ukuran + Harga Center */}
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Rasa</label>
                        <input
                            type="text"
                            value={form.data.flavor}
                            onChange={(e) => form.setData('flavor', e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            placeholder="Coklat"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Ukuran</label>
                        <input
                            type="text"
                            value={form.data.size}
                            onChange={(e) => form.setData('size', e.target.value)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            placeholder="250ml"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Harga Center (Rp)</label>
                        <input
                            type="number"
                            value={form.data.center_price}
                            onChange={(e) => form.setData('center_price', e.target.value)}
                            required
                            min="0"
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                {/* Auto-generated (editable) */}
                <div className="rounded-lg bg-surface-muted p-3">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-subtle">Otomatis (bisa diubah)</div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Nama Variant</label>
                            <input
                                type="text"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                required
                                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                            />
                            {form.errors.name && <p className="mt-1 text-xs text-red-600">{form.errors.name}</p>}
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">SKU</label>
                            <input
                                type="text"
                                value={form.data.sku}
                                onChange={(e) => form.setData('sku', e.target.value)}
                                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Harga Jual (Rp) <span className="text-text-subtle">({DEFAULT_MARKUP_PERCENT}% markup)</span></label>
                            <input
                                type="number"
                                value={form.data.selling_price}
                                onChange={(e) => form.setData('selling_price', e.target.value)}
                                required
                                min="0"
                                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Stok Pusat</label>
                            <input
                                type="number"
                                value={form.data.center_stock || '0'}
                                onChange={(e) => form.setData('center_stock', e.target.value)}
                                min="0"
                                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {editing && (
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.data.is_active}
                            onChange={(e) => form.setData('is_active', e.target.checked)}
                            className="rounded border-zinc-300"
                        />
                        <span className="text-sm text-zinc-700">Aktif</span>
                    </label>
                )}
                <div className="flex gap-2">
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary disabled:opacity-50"
                    >
                        {form.processing ? 'Menyimpan...' : editing ? 'Update' : 'Simpan'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-zinc-50"
                    >
                        Batal
                    </button>
                </div>
            </div>
        </form>
    );
}
