import { useForm } from '@inertiajs/react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import CustomSelect from '@/components/ui/custom-select';

interface Variant {
    id: number;
    name: string;
    center_price: number;
    stock: number;
}

interface Props {
    open: boolean;
    variants: Variant[];
    onClose: () => void;
}

export default function OfflineSaleDialog({
    open,
    variants = [],
    onClose,
}: Props) {
    const form = useForm({
        variant_id: '',
        quantity: 1,
        notes: '',
    });

    const variantOptions = variants.map((v) => ({
        value: String(v.id),
        label: v.name,
        subtitle: `Stok: ${v.stock} · @Rp ${Number(v.center_price).toLocaleString('id-ID')}`,
    }));

    const selectedVariant = variants.find(
        (v) => String(v.id) === form.data.variant_id,
    );
    const totalAmount = selectedVariant
        ? selectedVariant.center_price * form.data.quantity
        : 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/outlet/offline-sales', {
            onSuccess: () => {
                form.reset();
                onClose();
            },
        });
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
                className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="text-sm font-bold text-text">
                        Catat Penjualan
                    </h2>
                    <button
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-3 px-4 py-3">
                        <CustomSelect
                            label="Produk"
                            options={variantOptions}
                            value={form.data.variant_id}
                            onChange={(v: string) =>
                                form.setData('variant_id', v)
                            }
                            placeholder="Pilih produk"
                            searchable
                        />

                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="mb-1 block text-xs font-medium text-text-muted">
                                    Jumlah
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max={selectedVariant?.stock ?? 999}
                                    value={form.data.quantity}
                                    onChange={(e) =>
                                        form.setData(
                                            'quantity',
                                            Math.max(
                                                1,
                                                parseInt(e.target.value) || 1,
                                            ),
                                        )
                                    }
                                    className="min-h-11 w-full rounded-lg border border-border bg-surface text-center text-sm font-semibold text-text focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="mb-1 block text-xs font-medium text-text-muted">
                                    Catatan
                                </label>
                                <input
                                    type="text"
                                    value={form.data.notes}
                                    onChange={(e) =>
                                        form.setData('notes', e.target.value)
                                    }
                                    placeholder="Opsional"
                                    className="min-h-11 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-text placeholder:text-text-subtle focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                />
                            </div>
                        </div>

                        {form.errors.quantity && (
                            <p className="text-xs text-red-600">
                                {form.errors.quantity}
                            </p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="rounded-b-2xl border-t border-border bg-surface-muted/50 px-4 py-3">
                        {totalAmount > 0 && (
                            <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
                                <span>Hutang ke pusat</span>
                                <span className="font-semibold text-text">
                                    Rp {totalAmount.toLocaleString('id-ID')}
                                </span>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={form.processing || !form.data.variant_id}
                            className="min-h-11 w-full rounded-lg bg-emerald-600 text-sm font-bold text-white transition-colors active:opacity-80 disabled:bg-border disabled:text-text-subtle"
                        >
                            {form.processing ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
