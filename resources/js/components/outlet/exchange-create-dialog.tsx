import { useForm } from '@inertiajs/react';
import { X, Plus, Minus } from 'lucide-react';
import { createPortal } from 'react-dom';
import CustomSelect from '@/components/ui/custom-select';

interface VariantOption {
    id: number;
    name: string;
    full_name?: string;
    selling_price?: number;
}

interface InventoryOption {
    product_variant_id: number;
    variant: { id: number; name: string };
    current_stock: number;
}

interface Props {
    open: boolean;
    variants: VariantOption[];
    outletInventory: InventoryOption[];
    onClose: () => void;
}

export default function ExchangeCreateDialog({ open, variants = [], outletInventory = [], onClose }: Props) {
    const form = useForm({
        return_variant_id: '',
        return_quantity: 1,
        return_notes: '',
        replacement_variant_id: '',
        replacement_quantity: 1,
        replacement_notes: '',
    });

    const returnOptions = outletInventory.map((inv) => ({
        value: String(inv.product_variant_id),
        label: inv.variant.name,
        subtitle: `Stok: ${inv.current_stock}`,
    }));

    const replacementOptions = variants.map((v) => ({
        value: String(v.id),
        label: v.full_name ?? v.name,
        subtitle: v.selling_price ? `Rp ${Number(v.selling_price).toLocaleString('id-ID')}` : undefined,
    }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/outlet/exchanges', { onSuccess: () => onClose() });
    };

    if (!open) {
return null;
}

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h2 className="text-base font-bold text-text">Buat Penukaran</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-surface-muted transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {/* Return Section */}
                        <div className="rounded-xl border border-red-200 bg-red-50/50 p-2.5 space-y-2.5">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                <span className="text-xs font-bold text-red-700">Dikembalikan</span>
                            </div>

                            <CustomSelect
                                options={returnOptions}
                                value={form.data.return_variant_id}
                                onChange={(v: string) => form.setData('return_variant_id', v)}
                                placeholder="Pilih dari inventaris"
                                searchable
                            />

                            {/* Quantity + Notes inline row */}
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-text-muted mb-1 block">Jumlah</label>
                                    <div className="flex items-center gap-1.5">
                                        <button type="button" onClick={() => form.data.return_quantity > 1 && form.setData('return_quantity', form.data.return_quantity - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted transition-colors">
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <input type="number" min="1" value={form.data.return_quantity} onChange={(e) => form.setData('return_quantity', Math.max(1, parseInt(e.target.value) || 1))} className="w-14 h-8 text-center text-sm font-semibold text-text border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-300" />
                                        <button type="button" onClick={() => form.setData('return_quantity', form.data.return_quantity + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted transition-colors">
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-text-muted mb-1 block">Alasan</label>
                                    <input type="text" value={form.data.return_notes} onChange={(e) => form.setData('return_notes', e.target.value)} placeholder="Opsional" className="w-full h-8 rounded-lg border border-border bg-white px-2.5 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-red-300" />
                                </div>
                            </div>
                        </div>

                        {/* Replacement Section */}
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 space-y-2.5">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <span className="text-xs font-bold text-emerald-700">Pengganti</span>
                            </div>

                            <CustomSelect
                                options={replacementOptions}
                                value={form.data.replacement_variant_id}
                                onChange={(v: string) => form.setData('replacement_variant_id', v)}
                                placeholder="Pilih produk pengganti"
                                searchable
                            />

                            {/* Quantity + Notes inline row */}
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-text-muted mb-1 block">Jumlah</label>
                                    <div className="flex items-center gap-1.5">
                                        <button type="button" onClick={() => form.data.replacement_quantity > 1 && form.setData('replacement_quantity', form.data.replacement_quantity - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted transition-colors">
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <input type="number" min="1" value={form.data.replacement_quantity} onChange={(e) => form.setData('replacement_quantity', Math.max(1, parseInt(e.target.value) || 1))} className="w-14 h-8 text-center text-sm font-semibold text-text border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                                        <button type="button" onClick={() => form.setData('replacement_quantity', form.data.replacement_quantity + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted transition-colors">
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-text-muted mb-1 block">Catatan</label>
                                    <input type="text" value={form.data.replacement_notes} onChange={(e) => form.setData('replacement_notes', e.target.value)} placeholder="Opsional" className="w-full h-8 rounded-lg border border-border bg-white px-2.5 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-border bg-surface-muted/50">
                        <button
                            type="submit"
                            disabled={form.processing || !form.data.return_variant_id || !form.data.replacement_variant_id}
                            className="w-full h-11 rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80 disabled:bg-border disabled:text-text-subtle transition-colors"
                        >
                            {form.processing ? 'Mengirim...' : 'Kirim Penukaran'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    ,
        document.body,
    );

;
}
