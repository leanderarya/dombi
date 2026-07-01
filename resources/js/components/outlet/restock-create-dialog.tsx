import { createPortal } from 'react-dom';
import { useForm } from '@inertiajs/react';
import CustomSelect from '@/components/ui/custom-select';
import { X, Plus, Minus, StickyNote, ChevronDown } from 'lucide-react';

interface Variant {
    id: number;
    name: string;
    sku: string | null;
    product: { name: string };
}

interface Family {
    id: number;
    name: string;
    variants: Variant[];
}

interface InventoryItem {
    id: number;
    quantity: number;
    variant: Variant;
}

interface Props {
    open: boolean;
    families: Family[];
    inventories: InventoryItem[];
    onClose: () => void;
}

export default function RestockCreateDialog({ open, families = [], inventories = [], onClose }: Props) {
    const form = useForm({
        items: [{ variant_id: '', quantity: 1, notes: '' }],
    });

    // Build options from families → variants
    const variantOptions = families.flatMap((fam) =>
        fam.variants.map((v) => ({
            value: String(v.id),
            label: `${fam.name} — ${v.name}`,
            subtitle: `Stok: ${inventories.find((inv) => inv.variant?.id === v.id)?.quantity ?? 0}`,
        })),
    );

    const updateItem = (index: number, field: string, value: string | number) => {
        const updated = [...form.data.items];
        updated[index] = { ...updated[index], [field]: value };
        form.setData('items', updated);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/outlet/restocks', {
            onSuccess: () => onClose(),
        });
    };

    if (!open) return null;

    const selectedCount = form.data.items.filter((i) => i.variant_id).length;
    const totalQty = form.data.items.reduce((sum, i) => sum + i.quantity, 0);

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h2 className="text-base font-bold text-text">Buat Restock</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {/* Product selector */}
                        <CustomSelect
                            label="Produk"
                            options={variantOptions}
                            value={form.data.items[0]?.variant_id ?? ''}
                            onChange={(v: string) => updateItem(0, 'variant_id', v)}
                            placeholder="Pilih produk"
                            searchable
                        />

                        {/* Quantity stepper */}
                        <div>
                            <label className="text-xs font-medium text-text-muted mb-1.5 block">Jumlah</label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const current = form.data.items[0]?.quantity ?? 1;
                                        if (current > 1) updateItem(0, 'quantity', current - 1);
                                    }}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted transition-colors"
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.data.items[0]?.quantity ?? 1}
                                    onChange={(e) => updateItem(0, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-16 h-9 text-center text-sm font-semibold text-text border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const current = form.data.items[0]?.quantity ?? 1;
                                        updateItem(0, 'quantity', current + 1);
                                    }}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Notes — collapsible */}
                        <details className="group">
                            <summary className="flex items-center gap-1.5 text-xs font-medium text-text-muted cursor-pointer select-none hover:text-text transition-colors">
                                <StickyNote className="w-3.5 h-3.5" />
                                Tambah catatan
                                <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                            </summary>
                            <textarea
                                value={form.data.items[0]?.notes ?? ''}
                                onChange={(e) => updateItem(0, 'notes', e.target.value)}
                                placeholder="Catatan opsional"
                                rows={2}
                                className="mt-2 w-full text-sm text-text border border-border rounded-lg bg-surface px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-text-subtle"
                            />
                        </details>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-border bg-surface-muted/50">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-text-muted">
                                {selectedCount} produk · {totalQty} pcs
                            </span>
                        </div>
                        <button
                            type="submit"
                            disabled={form.processing || selectedCount === 0}
                            className="w-full h-11 rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80 disabled:bg-border disabled:text-text-subtle transition-colors"
                        >
                            {form.processing ? 'Mengirim...' : 'Kirim Restock'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
