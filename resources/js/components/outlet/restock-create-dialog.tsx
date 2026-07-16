import { useForm } from '@inertiajs/react';
import { X, Plus, Minus, StickyNote, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import CustomSelect from '@/components/ui/custom-select';

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

export default function RestockCreateDialog({
    open,
    families = [],
    inventories = [],
    onClose,
}: Props) {
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

    const updateItem = (
        index: number,
        field: string,
        value: string | number,
    ) => {
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

    if (!open) {
        return null;
    }

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
                className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="text-base font-bold text-text">
                        Buat Restock
                    </h2>
                    <button
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                        {/* Product selector */}
                        <CustomSelect
                            label="Produk"
                            options={variantOptions}
                            value={form.data.items[0]?.variant_id ?? ''}
                            onChange={(v: string) =>
                                updateItem(0, 'variant_id', v)
                            }
                            placeholder="Pilih produk"
                            searchable
                        />

                        {/* Quantity stepper */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-text-muted">
                                Jumlah
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const current =
                                            form.data.items[0]?.quantity ?? 1;

                                        if (current > 1) {
                                            updateItem(
                                                0,
                                                'quantity',
                                                current - 1,
                                            );
                                        }
                                    }}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-muted"
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.data.items[0]?.quantity ?? 1}
                                    onChange={(e) =>
                                        updateItem(
                                            0,
                                            'quantity',
                                            Math.max(
                                                1,
                                                parseInt(e.target.value) || 1,
                                            ),
                                        )
                                    }
                                    className="h-9 w-16 rounded-lg border border-border bg-surface text-center text-sm font-semibold text-text focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const current =
                                            form.data.items[0]?.quantity ?? 1;
                                        updateItem(0, 'quantity', current + 1);
                                    }}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-muted"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Notes — collapsible */}
                        <details className="group">
                            <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-text-muted transition-colors select-none hover:text-text">
                                <StickyNote className="h-3.5 w-3.5" />
                                Tambah catatan
                                <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                            </summary>
                            <textarea
                                value={form.data.items[0]?.notes ?? ''}
                                onChange={(e) =>
                                    updateItem(0, 'notes', e.target.value)
                                }
                                placeholder="Catatan opsional"
                                rows={2}
                                className="mt-2 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            />
                        </details>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border bg-surface-muted/50 px-4 py-3">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs text-text-muted">
                                {selectedCount} produk · {totalQty} pcs
                            </span>
                        </div>
                        <button
                            type="submit"
                            disabled={form.processing || selectedCount === 0}
                            className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white transition-colors active:opacity-80 disabled:bg-border disabled:text-text-subtle"
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
