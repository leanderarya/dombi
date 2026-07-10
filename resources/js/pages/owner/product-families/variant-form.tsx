import type { InertiaFormProps } from '@inertiajs/react';
import type { FormEventHandler } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    /** Pre-fill form for copy mode — name and sku are NOT pre-filled by caller */
    initialData?: {
        flavor?: string;
        size?: string;
        center_price?: number;
        selling_price?: number;
        center_stock?: number;
    };
}

export default function VariantForm({ form, editing, onSubmit, onCancel }: Props) {
    return (
        <form onSubmit={onSubmit} className="mb-4 rounded-lg border border-border bg-white p-4" aria-label={editing ? 'Edit Variant' : 'Tambah Variant'}>
            <h2 className="mb-3 text-sm font-semibold text-text">
                {editing ? 'Edit Variant' : 'Tambah Variant'}
            </h2>
            <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                    <Input
                        label="Rasa"
                        type="text"
                        value={form.data.flavor}
                        onChange={(e) => form.setData('flavor', e.target.value)}
                        placeholder="Coklat"
                    />
                    <Input
                        label="Ukuran"
                        type="text"
                        value={form.data.size}
                        onChange={(e) => form.setData('size', e.target.value)}
                        placeholder="250ml"
                    />
                    <Input
                        label="Harga Center (Rp)"
                        type="number"
                        value={form.data.center_price}
                        onChange={(e) => form.setData('center_price', e.target.value)}
                        required
                        min="0"
                    />
                </div>

                <div className="rounded-lg bg-surface-muted p-3" aria-label="Field otomatis">
                    <div className="mb-2 text-xs font-medium text-text-subtle">Otomatis (bisa diubah)</div>
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Nama Variant"
                            type="text"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            required
                            error={form.errors.name}
                            className="bg-white"
                        />
                        <Input
                            label="SKU"
                            type="text"
                            value={form.data.sku}
                            onChange={(e) => form.setData('sku', e.target.value)}
                            className="bg-white"
                        />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        <Input
                            label={`Harga Jual (Rp) (${DEFAULT_MARKUP_PERCENT}% markup)`}
                            type="number"
                            value={form.data.selling_price}
                            onChange={(e) => form.setData('selling_price', e.target.value)}
                            required
                            min="0"
                            className="bg-white"
                        />
                        <Input
                            label="Stok Pusat"
                            type="number"
                            value={form.data.center_stock || '0'}
                            onChange={(e) => form.setData('center_stock', e.target.value)}
                            min="0"
                            className="bg-white"
                        />
                    </div>
                </div>

                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={form.data.is_active}
                        onChange={(e) => form.setData('is_active', e.target.checked)}
                        className="rounded border-zinc-300"
                    />
                    <span className="text-sm text-zinc-700">Aktif</span>
                </label>
                <div className="flex gap-2">
                    <Button type="submit" loading={form.processing} className="flex-1">
                        {editing ? 'Update' : 'Simpan'}
                    </Button>
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Batal
                    </Button>
                </div>
            </div>
        </form>
    );
}
