import { Head, useForm } from '@inertiajs/react';
import { useState, useRef } from 'react';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency } from '@/lib/format';

export default function OutletReturnsCreate({ variants, reasons }: any) {
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
    const selectedSummary = Array.from(selectedVariants.entries()).reduce(
        (summary, [variantId, quantity]) => {
            const variant = variants.find((v: any) => v.id === variantId);

            return {
                totalItems: summary.totalItems + quantity,
                totalValue:
                    summary.totalValue +
                    Number(variant?.selling_price ?? 0) * quantity,
            };
        },
        { totalItems: 0, totalValue: 0 },
    );

    const toggleVariant = (variantId: number) => {
        const next = new Map(selectedVariants);

        if (next.has(variantId)) {
            next.delete(variantId);
        } else {
            const variant = variants.find((v: any) => v.id === variantId);
            next.set(
                variantId,
                Math.min(1, Number(variant?.available_stock ?? 1)),
            );
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
        const variant = variants.find((v: any) => v.id === variantId);
        const maxQty = Math.max(1, Number(variant?.available_stock ?? 1));
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
            alert('Maksimal 5 foto');

            return;
        }

        const newImages = [...form.data.evidence_images, ...files];
        form.setData('evidence_images', newImages);
        const newPreviews = files.map((file) => URL.createObjectURL(file));
        setImagePreviews((prev) => [...prev, ...newPreviews]);
    };

    const removeImage = (index: number) => {
        const newImages = form.data.evidence_images.filter(
            (_, i) => i !== index,
        );
        form.setData('evidence_images', newImages);
        URL.revokeObjectURL(imagePreviews[index]);
        setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        form.post('/outlet/returns');
    };

    return (
        <OutletLayout
            title="Ajukan Return"
            subtitle="Return stok outlet"
            backHref="/outlet/returns"
        >
            <Head title="Ajukan Return" />

            <div className="mt-4 pb-40">
                {/* Reason */}
                <div>
                    <label className="text-sm font-semibold text-text">
                        Alasan Return
                    </label>
                    <select
                        value={form.data.reason}
                        onChange={(e) => form.setData('reason', e.target.value)}
                        className="mt-2 w-full rounded-xl border border-border p-3 text-sm"
                    >
                        <option value="">Pilih alasan...</option>
                        {Object.entries(reasons).map(([key, label]) => (
                            <option key={key} value={key}>
                                {label as string}
                            </option>
                        ))}
                    </select>
                    {form.errors.reason && (
                        <div className="mt-1 text-xs text-red-600">
                            {form.errors.reason}
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div className="mt-4">
                    <label className="text-sm font-semibold text-text">
                        Catatan
                    </label>
                    <textarea
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        placeholder="Opsional"
                        className="mt-2 w-full rounded-xl border border-border p-3 text-sm"
                        rows={3}
                    />
                </div>

                {/* Evidence Photos */}
                <div className="mt-4">
                    <label className="text-sm font-semibold text-text">
                        Foto Bukti (Opsional)
                    </label>
                    <p className="mt-1 text-xs text-text-muted">
                        Upload foto kerusakan/masalah barang (maks. 5 foto)
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {imagePreviews.map((preview, index) => (
                            <div
                                key={index}
                                className="relative h-20 w-20 overflow-hidden rounded-lg border border-border"
                            >
                                <img
                                    src={preview}
                                    alt={`Bukti ${index + 1}`}
                                    className="h-full w-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        {form.data.evidence_images.length < 5 && (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-border text-text-subtle"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-6 w-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                            </button>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/jpg"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                    />
                    {form.errors.evidence_images && (
                        <div className="mt-1 text-xs text-red-600">
                            {form.errors.evidence_images}
                        </div>
                    )}
                </div>

                {/* Variant Selection */}
                <div className="mt-6">
                    <label className="text-sm font-semibold text-text">
                        Pilih Produk
                    </label>
                    <div className="mt-2 space-y-2">
                        {variants.map((v: any) => {
                            const isSelected = selectedVariants.has(v.id);
                            const availableStock = Number(
                                v.available_stock ?? 0,
                            );

                            return (
                                <div
                                    key={v.id}
                                    className={`rounded-xl border p-3 transition-colors ${isSelected ? 'border-primary bg-primary-light' : 'border-border bg-white'}`}
                                >
                                    <button
                                        onClick={() => toggleVariant(v.id)}
                                        disabled={availableStock <= 0}
                                        className="flex min-h-11 w-full items-center gap-3 text-left disabled:opacity-50"
                                    >
                                        <div
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-primary' : 'border-border'}`}
                                        >
                                            {isSelected && (
                                                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-text">
                                                {v.full_name ?? v.name}
                                            </div>
                                            <div className="text-xs text-text-muted">
                                                {formatCurrency(
                                                    v.selling_price,
                                                )}{' '}
                                                · tersedia {availableStock}
                                            </div>
                                        </div>
                                    </button>
                                    {isSelected && (
                                        <div className="mt-2 flex items-center justify-end gap-2">
                                            <button
                                                onClick={() =>
                                                    updateQuantity(
                                                        v.id,
                                                        (selectedVariants.get(
                                                            v.id,
                                                        ) ?? 1) - 1,
                                                    )
                                                }
                                                className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-text-muted"
                                            >
                                                -
                                            </button>
                                            <span className="w-8 text-center text-sm font-bold">
                                                {selectedVariants.get(v.id) ??
                                                    1}
                                            </span>
                                            <button
                                                onClick={() =>
                                                    updateQuantity(
                                                        v.id,
                                                        (selectedVariants.get(
                                                            v.id,
                                                        ) ?? 1) + 1,
                                                    )
                                                }
                                                className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-text-muted"
                                            >
                                                +
                                            </button>
                                        </div>
                                    )}
                                    {form.errors[
                                        `items.${Array.from(selectedVariants.keys()).indexOf(v.id)}.quantity` as keyof typeof form.errors
                                    ] && (
                                        <div className="mt-1 text-xs text-red-600">
                                            {
                                                form.errors[
                                                    `items.${Array.from(selectedVariants.keys()).indexOf(v.id)}.quantity` as keyof typeof form.errors
                                                ]
                                            }
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {form.errors.items && (
                        <div className="mt-1 text-xs text-red-600">
                            {form.errors.items}
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky Submit */}
            <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0))] z-30 border-t border-border bg-white/95 pt-3 pb-3 backdrop-blur">
                <div className="mx-auto max-w-lg px-4">
                    <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-surface-muted px-3 py-2">
                        <div>
                            <div className="text-xs font-semibold text-text-muted">
                                Total Items
                            </div>
                            <div className="text-sm font-bold text-text">
                                {selectedSummary.totalItems} Produk
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-semibold text-text-muted">
                                Nilai Return
                            </div>
                            <div className="text-sm font-bold text-primary">
                                {formatCurrency(selectedSummary.totalValue)}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={
                            form.processing || selectedVariants.size === 0
                        }
                        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                    >
                        {form.processing ? 'Mengirim...' : 'Ajukan Return'}
                    </button>
                </div>
            </div>
        </OutletLayout>
    );
}
