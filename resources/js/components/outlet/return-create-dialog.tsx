import { useForm } from '@inertiajs/react';
import { X, Plus, Minus, Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CustomSelect from '@/components/ui/custom-select';

interface VariantOption {
    id: number;
    name: string;
    full_name?: string;
    selling_price: number;
    available_stock: number;
}

interface Props {
    open: boolean;
    variants: VariantOption[];
    reasons: Record<string, string>;
    onClose: () => void;
}

export default function ReturnCreateDialog({
    open,
    variants = [],
    reasons = {},
    onClose,
}: Props) {
    const form = useForm({
        reason: '',
        notes: '',
        items: [] as { product_variant_id: number; quantity: number }[],
        evidence_images: [] as File[],
    });

    const [selectedVariants, setSelectedVariants] = useState<
        Map<number, number>
    >(new Map());
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const variantOptions = variants.map((v) => ({
        value: String(v.id),
        label: v.full_name ?? v.name,
        subtitle: `Stok: ${v.available_stock}`,
    }));

    const reasonOptions = Object.entries(reasons).map(([key, label]) => ({
        value: key,
        label: label,
    }));

    const toggleVariant = (variantId: number) => {
        const next = new Map(selectedVariants);

        if (next.has(variantId)) {
            next.delete(variantId);
        } else {
            const variant = variants.find((v) => v.id === variantId);
            next.set(variantId, Math.min(1, variant?.available_stock ?? 1));
        }

        setSelectedVariants(next);
        form.setData(
            'items',
            Array.from(next.entries()).map(([id, qty]) => ({
                product_variant_id: id,
                quantity: qty,
            })),
        );
    };

    const updateQuantity = (variantId: number, qty: number) => {
        const variant = variants.find((v) => v.id === variantId);
        const maxQty = Math.max(1, variant?.available_stock ?? 1);
        const next = new Map(selectedVariants);
        next.set(variantId, Math.min(maxQty, Math.max(1, qty)));
        setSelectedVariants(next);
        form.setData(
            'items',
            Array.from(next.entries()).map(([id, q]) => ({
                product_variant_id: id,
                quantity: q,
            })),
        );
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);

        if (files.length + form.data.evidence_images.length > 5) {
            return;
        }

        form.setData('evidence_images', [
            ...form.data.evidence_images,
            ...files,
        ]);
        setImagePreviews((prev) => [
            ...prev,
            ...files.map((f) => URL.createObjectURL(f)),
        ]);
    };

    const removeImage = (index: number) => {
        form.setData(
            'evidence_images',
            form.data.evidence_images.filter((_, i) => i !== index),
        );
        URL.revokeObjectURL(imagePreviews[index]);
        setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/outlet/returns', {
            onSuccess: () => {
                setSelectedVariants(new Map());
                setImagePreviews([]);
                onClose();
            },
        });
    };

    if (!open) {
        return null;
    }

    const selectedSummary = Array.from(selectedVariants.entries()).reduce(
        (acc, [variantId, quantity]) => {
            const variant = variants.find((v) => v.id === variantId);

            return {
                totalItems: acc.totalItems + quantity,
                totalValue:
                    acc.totalValue +
                    Number(variant?.selling_price ?? 0) * quantity,
            };
        },
        { totalItems: 0, totalValue: 0 },
    );

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
                        Ajukan Return
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
                    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        {/* Reason */}
                        <CustomSelect
                            label="Alasan Return"
                            options={reasonOptions}
                            value={form.data.reason}
                            onChange={(v: string) => form.setData('reason', v)}
                            placeholder="Pilih alasan"
                        />

                        {/* Notes */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-text-muted">
                                Catatan
                            </label>
                            <textarea
                                value={form.data.notes}
                                onChange={(e) =>
                                    form.setData('notes', e.target.value)
                                }
                                placeholder="Opsional"
                                rows={2}
                                className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-subtle focus:ring-2 focus:ring-primary/30 focus:outline-none"
                            />
                        </div>

                        {/* Evidence Photos */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-text-muted">
                                Foto Bukti (Opsional)
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {imagePreviews.map((preview, index) => (
                                    <div
                                        key={index}
                                        className="relative h-16 w-16 overflow-hidden rounded-lg border border-border"
                                    >
                                        <img
                                            src={preview}
                                            alt=""
                                            className="h-full w-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="absolute top-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                                {form.data.evidence_images.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-border text-text-subtle transition-colors hover:border-primary hover:text-primary"
                                    >
                                        <Camera className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>

                        {/* Variant Selection */}
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-text-muted">
                                Pilih Produk
                            </label>
                            <div className="space-y-2">
                                {variants.map((v) => {
                                    const isSelected = selectedVariants.has(
                                        v.id,
                                    );

                                    return (
                                        <div
                                            key={v.id}
                                            className={`rounded-xl border p-3 transition-colors ${isSelected ? 'border-primary bg-primary-light' : 'border-border bg-white'}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleVariant(v.id)
                                                }
                                                disabled={
                                                    v.available_stock <= 0
                                                }
                                                className="flex w-full items-center gap-3 text-left disabled:opacity-50"
                                            >
                                                <div
                                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-primary' : 'border-border'}`}
                                                >
                                                    {isSelected && (
                                                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-medium text-text">
                                                        {v.full_name ?? v.name}
                                                    </div>
                                                    <div className="text-xs text-text-subtle">
                                                        Tersedia:{' '}
                                                        {v.available_stock}
                                                    </div>
                                                </div>
                                            </button>
                                            {isSelected && (
                                                <div className="mt-2 flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateQuantity(
                                                                v.id,
                                                                (selectedVariants.get(
                                                                    v.id,
                                                                ) ?? 1) - 1,
                                                            )
                                                        }
                                                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted"
                                                    >
                                                        <Minus className="h-3.5 w-3.5" />
                                                    </button>
                                                    <span className="w-8 text-center text-sm font-bold text-text">
                                                        {selectedVariants.get(
                                                            v.id,
                                                        ) ?? 1}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateQuantity(
                                                                v.id,
                                                                (selectedVariants.get(
                                                                    v.id,
                                                                ) ?? 1) + 1,
                                                            )
                                                        }
                                                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border bg-surface-muted/50 px-4 py-3">
                        <div className="mb-3 flex items-center justify-between text-xs text-text-muted">
                            <span>{selectedSummary.totalItems} produk</span>
                        </div>
                        <button
                            type="submit"
                            disabled={
                                form.processing || selectedVariants.size === 0
                            }
                            className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white transition-colors active:opacity-80 disabled:bg-border disabled:text-text-subtle"
                        >
                            {form.processing ? 'Mengirim...' : 'Ajukan Return'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
