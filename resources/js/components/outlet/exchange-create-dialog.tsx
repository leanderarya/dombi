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

export default function ExchangeCreateDialog({
    open,
    variants = [],
    outletInventory = [],
    onClose,
}: Props) {
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
        subtitle: v.selling_price
            ? `Rp ${Number(v.selling_price).toLocaleString('id-ID')}`
            : undefined,
    }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/outlet/exchanges', { onSuccess: () => onClose() });
    };

    if (!open) {
        return null;
    }

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
                        Buat Penukaran
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
                        {/* Return Section */}
                        <div className="space-y-2.5 rounded-xl border border-red-200 bg-red-50/50 p-2.5">
                            <div className="mb-1 flex items-center gap-2">
                                <div className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                                <span className="text-xs font-bold text-red-700">
                                    Dikembalikan
                                </span>
                            </div>

                            <CustomSelect
                                options={returnOptions}
                                value={form.data.return_variant_id}
                                onChange={(v: string) =>
                                    form.setData('return_variant_id', v)
                                }
                                placeholder="Pilih dari inventaris"
                                searchable
                            />

                            {/* Quantity + Notes inline row */}
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="mb-1 block text-xs font-medium text-text-muted">
                                        Jumlah
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                form.data.return_quantity > 1 &&
                                                form.setData(
                                                    'return_quantity',
                                                    form.data.return_quantity -
                                                        1,
                                                )
                                            }
                                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-muted"
                                        >
                                            <Minus className="h-3 w-3" />
                                        </button>
                                        <input
                                            type="number"
                                            min="1"
                                            value={form.data.return_quantity}
                                            onChange={(e) =>
                                                form.setData(
                                                    'return_quantity',
                                                    Math.max(
                                                        1,
                                                        parseInt(
                                                            e.target.value,
                                                        ) || 1,
                                                    ),
                                                )
                                            }
                                            className="h-8 w-14 rounded-lg border border-border bg-white text-center text-sm font-semibold text-text focus:ring-2 focus:ring-red-300 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                form.setData(
                                                    'return_quantity',
                                                    form.data.return_quantity +
                                                        1,
                                                )
                                            }
                                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-muted"
                                        >
                                            <Plus className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="mb-1 block text-xs font-medium text-text-muted">
                                        Alasan
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.return_notes}
                                        onChange={(e) =>
                                            form.setData(
                                                'return_notes',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Opsional"
                                        className="h-8 w-full rounded-lg border border-border bg-white px-2.5 text-sm text-text placeholder:text-text-subtle focus:ring-2 focus:ring-red-300 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Replacement Section */}
                        <div className="space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                            <div className="mb-1 flex items-center gap-2">
                                <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                <span className="text-xs font-bold text-emerald-700">
                                    Pengganti
                                </span>
                            </div>

                            <CustomSelect
                                options={replacementOptions}
                                value={form.data.replacement_variant_id}
                                onChange={(v: string) =>
                                    form.setData('replacement_variant_id', v)
                                }
                                placeholder="Pilih produk pengganti"
                                searchable
                            />

                            {/* Quantity + Notes inline row */}
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="mb-1 block text-xs font-medium text-text-muted">
                                        Jumlah
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                form.data.replacement_quantity >
                                                    1 &&
                                                form.setData(
                                                    'replacement_quantity',
                                                    form.data
                                                        .replacement_quantity -
                                                        1,
                                                )
                                            }
                                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-muted"
                                        >
                                            <Minus className="h-3 w-3" />
                                        </button>
                                        <input
                                            type="number"
                                            min="1"
                                            value={
                                                form.data.replacement_quantity
                                            }
                                            onChange={(e) =>
                                                form.setData(
                                                    'replacement_quantity',
                                                    Math.max(
                                                        1,
                                                        parseInt(
                                                            e.target.value,
                                                        ) || 1,
                                                    ),
                                                )
                                            }
                                            className="h-8 w-14 rounded-lg border border-border bg-white text-center text-sm font-semibold text-text focus:ring-2 focus:ring-emerald-300 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                form.setData(
                                                    'replacement_quantity',
                                                    form.data
                                                        .replacement_quantity +
                                                        1,
                                                )
                                            }
                                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-muted"
                                        >
                                            <Plus className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="mb-1 block text-xs font-medium text-text-muted">
                                        Catatan
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.replacement_notes}
                                        onChange={(e) =>
                                            form.setData(
                                                'replacement_notes',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Opsional"
                                        className="h-8 w-full rounded-lg border border-border bg-white px-2.5 text-sm text-text placeholder:text-text-subtle focus:ring-2 focus:ring-emerald-300 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border bg-surface-muted/50 px-4 py-3">
                        <button
                            type="submit"
                            disabled={
                                form.processing ||
                                !form.data.return_variant_id ||
                                !form.data.replacement_variant_id
                            }
                            className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white transition-colors active:opacity-80 disabled:bg-border disabled:text-text-subtle"
                        >
                            {form.processing
                                ? 'Mengirim...'
                                : 'Kirim Penukaran'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
