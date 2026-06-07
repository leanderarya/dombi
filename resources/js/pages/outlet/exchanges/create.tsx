import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency } from '@/lib/format';

export default function OutletExchangesCreate({ variants, pendingReturns }: any) {
    const form = useForm({
        return_request_id: null as number | null,
        notes: '',
        items: [] as { product_variant_id: number; quantity: number }[],
    });

    const [selectedVariants, setSelectedVariants] = useState<Map<number, number>>(new Map());
    const selectedSummary = Array.from(selectedVariants.entries()).reduce(
        (summary, [variantId, quantity]) => {
            const variant = variants.find((v: any) => v.id === variantId);
            return {
                totalItems: summary.totalItems + quantity,
                totalValue: summary.totalValue + Number(variant?.selling_price ?? 0) * quantity,
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
            next.set(variantId, Math.min(1, Number(variant?.available_stock ?? 1)));
        }
        setSelectedVariants(next);
        form.setData('items', Array.from(next.entries()).map(([id, qty]) => ({ product_variant_id: id, quantity: qty })));
    };

    const updateQuantity = (variantId: number, qty: number) => {
        const variant = variants.find((v: any) => v.id === variantId);
        const maxQty = Math.max(1, Number(variant?.available_stock ?? 1));
        const next = new Map(selectedVariants);
        next.set(variantId, Math.min(maxQty, Math.max(1, qty)));
        setSelectedVariants(next);
        form.setData('items', Array.from(next.entries()).map(([id, q]) => ({ product_variant_id: id, quantity: q })));
    };

    const handleSubmit = () => {
        form.post('/outlet/exchanges');
    };

    return (
        <OutletLayout title="Ajukan Tukar Produk" subtitle="Request produk pengganti" backHref="/outlet/exchanges">
            <Head title="Ajukan Tukar Produk" />

            <div className="pb-40">
                {/* Link to return */}
                {pendingReturns.length > 0 && (
                    <div className="mt-6">
                        <label className="text-sm font-semibold text-slate-900">Return Terkait (Opsional)</label>
                        <select
                            value={form.data.return_request_id ?? ''}
                            onChange={(e) => form.setData('return_request_id', e.target.value ? Number(e.target.value) : null)}
                            className="mt-2 w-full rounded-xl border border-zinc-200 p-3 text-sm"
                        >
                            <option value="">Tanpa return</option>
                            {pendingReturns.map((r: any) => (
                                <option key={r.id} value={r.id}>Return #{r.id} - {formatCurrency(r.total_value)}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Notes */}
                <div className="mt-4">
                    <label className="text-sm font-semibold text-slate-900">Catatan</label>
                    <textarea
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        placeholder="Opsional"
                        className="mt-2 w-full rounded-xl border border-zinc-200 p-3 text-sm"
                        rows={3}
                    />
                </div>

                {/* Variant Selection */}
                <div className="mt-6">
                    <label className="text-sm font-semibold text-slate-900">Pilih Produk Pengganti</label>
                    <div className="mt-2 space-y-2">
                        {variants.map((v: any) => {
                            const isSelected = selectedVariants.has(v.id);
                            const availableStock = Number(v.available_stock ?? 0);
                            return (
                                <div key={v.id} className={`rounded-xl border p-3 transition-colors ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 bg-white'}`}>
                                    <button onClick={() => toggleVariant(v.id)} disabled={availableStock <= 0} className="flex min-h-11 w-full items-center gap-3 text-left disabled:opacity-50">
                                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? 'border-emerald-600' : 'border-zinc-300'}`}>
                                            {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-slate-900">{v.full_name ?? v.name}</div>
                                            <div className="text-xs text-zinc-500">{formatCurrency(v.selling_price)} · tersedia {availableStock}</div>
                                        </div>
                                    </button>
                                    {isSelected && (
                                        <div className="mt-2 flex items-center justify-end gap-2">
                                            <button onClick={() => updateQuantity(v.id, (selectedVariants.get(v.id) ?? 1) - 1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600">-</button>
                                            <span className="w-8 text-center text-sm font-bold">{selectedVariants.get(v.id) ?? 1}</span>
                                            <button onClick={() => updateQuantity(v.id, (selectedVariants.get(v.id) ?? 1) + 1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600">+</button>
                                        </div>
                                    )}
                                    {form.errors[`items.${Array.from(selectedVariants.keys()).indexOf(v.id)}.quantity` as keyof typeof form.errors] && (
                                        <div className="mt-1 text-xs text-red-600">{form.errors[`items.${Array.from(selectedVariants.keys()).indexOf(v.id)}.quantity` as keyof typeof form.errors]}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {form.errors.items && <div className="mt-1 text-xs text-red-600">{form.errors.items}</div>}
                </div>
            </div>

            {/* Sticky Submit */}
            <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-zinc-200 bg-white/95 backdrop-blur pb-3 pt-3">
                <div className="mx-auto max-w-lg px-4">
                    <div className="mb-3 flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2">
                        <div>
                            <div className="text-xs font-semibold text-zinc-500">Total Items</div>
                            <div className="text-sm font-bold text-slate-900">{selectedSummary.totalItems} Produk</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-semibold text-zinc-500">Nilai Tukar</div>
                            <div className="text-sm font-bold text-emerald-700">{formatCurrency(selectedSummary.totalValue)}</div>
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={form.processing || selectedVariants.size === 0}
                        className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-50"
                    >
                        {form.processing ? 'Mengirim...' : 'Ajukan Tukar Produk'}
                    </button>
                </div>
            </div>
        </OutletLayout>
    );
}
