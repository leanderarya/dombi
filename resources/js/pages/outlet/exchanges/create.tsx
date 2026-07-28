import { Head, useForm } from '@inertiajs/react';
import { ArrowRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency } from '@/lib/format';

interface PairedItem {
    return_variant_id: number;
    return_quantity: number;
    replacement_variant_id: number;
    replacement_quantity: number;
}

interface FormItem {
    product_variant_id: number;
    quantity: number;
    replacement_variant_id: number;
    replacement_quantity: number;
}

export default function OutletExchangesCreate({
    variants,
    exchangeEligibleReturns,
}: any) {
    const form = useForm({
        return_request_id: null as number | null,
        notes: '',
        items: [] as FormItem[],
    });

    const [selectedReturnId, setSelectedReturnId] = useState<number | null>(
        null,
    );
    const [pairs, setPairs] = useState<PairedItem[]>([]);

    const allVariants = variants ?? [];
    const eligibleReturns = exchangeEligibleReturns ?? [];

    const selectedReturn = selectedReturnId
        ? eligibleReturns.find((r: any) => r.id === selectedReturnId)
        : null;

    const getReturnItemName = (variantId: number): string => {
        if (!selectedReturn) {
            return '-';
        }

        const item = selectedReturn.items.find(
            (i: any) => i.product_variant_id === variantId,
        );

        return item?.variant?.full_name ?? item?.variant?.name ?? '-';
    };

    const handleReturnSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value ? Number(e.target.value) : null;
        setSelectedReturnId(id);
        form.setData('return_request_id', id);

        if (id) {
            const ret = eligibleReturns.find((r: any) => r.id === id);

            if (ret) {
                const newPairs: PairedItem[] = ret.items.map((item: any) => ({
                    return_variant_id: item.product_variant_id,
                    return_quantity: item.quantity,
                    replacement_variant_id: 0,
                    replacement_quantity: 1,
                }));
                setPairs(newPairs);
                syncForm(newPairs);
            }
        } else {
            setPairs([]);
            syncForm([]);
        }
    };

    const updatePair = (
        index: number,
        field: 'replacement_variant_id' | 'replacement_quantity',
        value: number,
    ) => {
        const updated = [...pairs];
        updated[index] = { ...updated[index], [field]: value };
        setPairs(updated);
        syncForm(updated);
    };

    const removePair = (index: number) => {
        const updated = pairs.filter((_, i) => i !== index);
        setPairs(updated);
        syncForm(updated);
    };

    const syncForm = (items: PairedItem[]) => {
        form.setData(
            'items',
            items
                .filter(
                    (p) =>
                        p.return_variant_id > 0 && p.replacement_variant_id > 0,
                )
                .map((p) => ({
                    product_variant_id: p.return_variant_id,
                    quantity: p.return_quantity,
                    replacement_variant_id: p.replacement_variant_id,
                    replacement_quantity: p.replacement_quantity,
                })),
        );
    };

    const handleSubmit = () => {
        form.post('/outlet/exchanges', {
            onSuccess: () => toast.success('Penukaran diajukan'),
            onError: (errors) =>
                toast.error(Object.values(errors).flat().join(', ')),
        });
    };

    const getVariantName = (id: number) =>
        allVariants.find((v: any) => v.id === id)?.full_name ??
        allVariants.find((v: any) => v.id === id)?.name ??
        '-';

    const validCount = pairs.filter(
        (p) => p.return_variant_id > 0 && p.replacement_variant_id > 0,
    ).length;

    if (!eligibleReturns.length) {
        return (
            <OutletLayout
                title="Ajukan Tukar Produk"
                subtitle="Tukar produk lama dengan produk baru"
                backHref="/outlet/exchanges"
            >
                <Head title="Ajukan Tukar Produk" />
                <div className="mt-20 text-center">
                    <p className="text-sm text-text-muted">
                        Tidak ada return yang sudah diterima pusat. Buat return
                        terlebih dahulu.
                    </p>
                </div>
            </OutletLayout>
        );
    }

    return (
        <OutletLayout
            title="Ajukan Tukar Produk"
            subtitle="Tukar produk lama dengan produk baru"
            backHref="/outlet/exchanges"
        >
            <Head title="Ajukan Tukar Produk" />

            <div className="mt-4 pb-40">
                {/* Mandatory Return Selection */}
                <div className="mb-4">
                    <label className="text-xs font-semibold text-text-muted">
                        Pilih Return
                    </label>
                    <select
                        value={selectedReturnId ?? ''}
                        onChange={handleReturnSelect}
                        className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm"
                    >
                        <option value="">Pilih return...</option>
                        {eligibleReturns.map((r: any) => (
                            <option key={r.id} value={r.id}>
                                Return #{r.id} - {formatCurrency(r.total_value)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Paired Items */}
                {selectedReturnId &&
                    pairs.map((pair, index) => (
                        <div
                            key={index}
                            className="rounded-xl border border-border bg-white p-4"
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-xs font-bold tracking-wider text-text-subtle uppercase">
                                    Pasangan {index + 1}
                                </span>
                                {pairs.length > 1 && (
                                    <button
                                        onClick={() => removePair(index)}
                                        className="rounded-lg p-1.5 text-text-subtle hover:bg-red-50 hover:text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Return side - read-only */}
                            <div>
                                <label className="mb-1 block text-xs font-medium text-red-600">
                                    Dikembalikan (Produk Lama)
                                </label>
                                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 px-3 py-2.5 text-sm">
                                    <span className="font-medium text-red-800">
                                        {getReturnItemName(
                                            pair.return_variant_id,
                                        )}{' '}
                                        x{pair.return_quantity}
                                    </span>
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="my-3 flex justify-center">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light">
                                    <ArrowRight className="h-4 w-4 text-primary" />
                                </div>
                            </div>

                            {/* Replacement side */}
                            <div>
                                <label className="mb-1 block text-xs font-medium text-emerald-600">
                                    Diganti Dengan (Produk Baru)
                                </label>
                                <select
                                    value={pair.replacement_variant_id || ''}
                                    onChange={(e) =>
                                        updatePair(
                                            index,
                                            'replacement_variant_id',
                                            Number(e.target.value),
                                        )
                                    }
                                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
                                >
                                    <option value="">
                                        Pilih produk pengganti...
                                    </option>
                                    {allVariants.map((v: any) => (
                                        <option key={v.id} value={v.id}>
                                            {v.full_name ?? v.name} -{' '}
                                            {formatCurrency(v.selling_price)}
                                        </option>
                                    ))}
                                </select>
                                <div className="mt-2 flex items-center gap-2">
                                    <label className="text-xs text-text-muted">
                                        Jumlah:
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={pair.replacement_quantity}
                                        onChange={(e) =>
                                            updatePair(
                                                index,
                                                'replacement_quantity',
                                                Math.max(
                                                    1,
                                                    Number(e.target.value),
                                                ),
                                            )
                                        }
                                        className="w-20 rounded-lg border border-border px-2 py-1.5 text-center text-sm"
                                    />
                                </div>
                            </div>

                            {/* Summary */}
                            {pair.replacement_variant_id > 0 && (
                                <div className="mt-3 rounded-lg bg-surface-muted p-2.5 text-xs">
                                    <span className="text-text-muted">
                                        {getReturnItemName(
                                            pair.return_variant_id,
                                        )}{' '}
                                        x{pair.return_quantity}
                                    </span>
                                    <span className="mx-2 text-text-subtle">
                                        &rarr;
                                    </span>
                                    <span className="font-semibold text-text">
                                        {getVariantName(
                                            pair.replacement_variant_id,
                                        )}{' '}
                                        x{pair.replacement_quantity}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
            </div>

            {/* Notes */}
            <div className="mx-auto mt-4 max-w-lg px-4">
                <label className="mb-1 block text-xs font-medium text-text-muted">
                    Catatan
                </label>
                <textarea
                    value={form.data.notes}
                    onChange={(e) => form.setData('notes', e.target.value)}
                    placeholder="Opsional"
                    rows={2}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm placeholder:text-text-subtle"
                />
            </div>

            {Object.keys(form.errors).length > 0 && (
                <div className="mx-auto mt-2 max-w-lg px-4">
                    <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                        {Object.values(form.errors).flat().join(', ')}
                    </div>
                </div>
            )}

            {/* Sticky Submit */}
            <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0))] z-30 border-t border-border bg-white/95 pt-3 pb-3 backdrop-blur">
                <div className="mx-auto max-w-lg px-4">
                    <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-surface-muted px-3 py-2">
                        <div>
                            <div className="text-xs font-semibold text-text-muted">
                                Pasangan
                            </div>
                            <div className="text-sm font-bold text-text">
                                {validCount} Item
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={form.processing || validCount === 0}
                        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white active:bg-primary disabled:opacity-50"
                    >
                        {form.processing
                            ? 'Mengirim...'
                            : 'Ajukan Tukar Produk'}
                    </button>
                </div>
            </div>
        </OutletLayout>
    );
}
