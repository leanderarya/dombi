import { useForm } from '@inertiajs/react';
import { X, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';

interface VariantOption {
    id: number;
    name: string;
    full_name?: string;
    selling_price?: number;
}

interface ReturnItem {
    product_variant_id: number;
    quantity: number;
    variant: {
        id: number;
        name: string;
        full_name?: string;
        selling_price?: number;
    };
}

interface ReturnOption {
    id: number;
    total_value: number;
    items: ReturnItem[];
}

interface Props {
    open: boolean;
    variants: VariantOption[];
    exchangeEligibleReturns: ReturnOption[];
    onClose: () => void;
}

interface PairedItem {
    return_variant_id: number;
    return_quantity: number;
    replacement_variant_id: number;
    replacement_quantity: number;
    replacement_search: string;
}

export default function ExchangeCreateDialog({
    open,
    variants = [],
    exchangeEligibleReturns = [],
    onClose,
}: Props) {
    const [selectedReturnId, setSelectedReturnId] = useState<number | null>(
        null,
    );
    const [pairs, setPairs] = useState<PairedItem[]>([]);
    const [notes, setNotes] = useState('');

    const allVariants = variants ?? [];
    const eligibleReturns = exchangeEligibleReturns ?? [];

    const selectedReturn = selectedReturnId
        ? eligibleReturns.find((r) => r.id === selectedReturnId)
        : null;

    const form = useForm({
        items: [] as {
            product_variant_id: number;
            quantity: number;
            replacement_variant_id: number;
            replacement_quantity: number;
        }[],
        notes: '',
    });

    const getReturnItemName = (variantId: number): string => {
        if (!selectedReturn) {
            return '-';
        }

        const item = selectedReturn.items.find(
            (i) => i.product_variant_id === variantId,
        );

        return item?.variant?.full_name ?? item?.variant?.name ?? '-';
    };

    const syncForm = (updated: PairedItem[], notesValue: string) => {
        form.setData({
            items: updated
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
            notes: notesValue,
        });
    };

    const handleReturnSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value ? Number(e.target.value) : null;
        setSelectedReturnId(id);

        if (id) {
            const ret = eligibleReturns.find((r) => r.id === id);

            if (ret) {
                const newPairs: PairedItem[] = ret.items.map((item) => ({
                    return_variant_id: item.product_variant_id,
                    return_quantity: item.quantity,
                    replacement_variant_id: 0,
                    replacement_quantity: 1,
                    replacement_search: '',
                }));
                setPairs(newPairs);
                syncForm(newPairs, notes);
            }
        } else {
            setPairs([]);
            syncForm([], notes);
        }
    };

    const updatePair = (index: number, patch: Partial<PairedItem>) => {
        const updated = [...pairs];
        updated[index] = { ...updated[index], ...patch };
        setPairs(updated);
        syncForm(updated, notes);
    };

    const updateReplacementQty = (index: number, qty: number) => {
        updatePair(index, { replacement_quantity: Math.max(1, qty || 1) });
    };

    const removePair = (index: number) => {
        const updated = pairs.filter((_, i) => i !== index);
        setPairs(updated);
        syncForm(updated, notes);
    };

    const handleNotesChange = (value: string) => {
        setNotes(value);
        syncForm(pairs, value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedReturnId) {
            toast.error('Pilih return terlebih dahulu');

            return;
        }

        const valid = pairs.filter(
            (p) => p.return_variant_id > 0 && p.replacement_variant_id > 0,
        );

        if (valid.length === 0) {
            toast.error('Pilih minimal 1 pasangan produk');

            return;
        }

        const payload = {
            items: valid.map((p) => ({
                product_variant_id: p.return_variant_id,
                quantity: p.return_quantity,
                replacement_variant_id: p.replacement_variant_id,
                replacement_quantity: p.replacement_quantity,
            })),
            notes: notes,
        };

        form.transform(() => payload);

        form.post('/outlet/exchanges', {
            onSuccess: () => {
                toast.success('Penukaran diajukan');
                setSelectedReturnId(null);
                setPairs([]);
                setNotes('');
                form.reset();
                onClose();
            },
            onError: (errors: Record<string, string | string[]>) => {
                const message = Object.values(errors)
                    .flatMap((v) => (Array.isArray(v) ? v : [v]))
                    .join(', ');
                toast.error(message);
            },
        });
    };

    if (!open) {
        return null;
    }

    const validCount = pairs.filter(
        (p) => p.return_variant_id > 0 && p.replacement_variant_id > 0,
    ).length;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

            <div
                onClick={(e) => e.stopPropagation()}
                className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
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
                    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-40">
                        {/* Return Selection */}
                        <div>
                            <label className="text-xs font-semibold text-text-muted">
                                Pilih Return
                            </label>
                            {eligibleReturns.length === 0 ? (
                                <div className="mt-1 rounded-xl bg-red-50 p-3 text-center text-sm text-red-700">
                                    Tidak ada return yang sudah diterima pusat.
                                    Buat return terlebih dahulu.
                                </div>
                            ) : (
                                <select
                                    value={selectedReturnId ?? ''}
                                    onChange={handleReturnSelect}
                                    className="mt-1 w-full rounded-xl border border-border p-3 text-sm"
                                >
                                    <option value="">Pilih return...</option>
                                    {eligibleReturns.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            Return #{r.id} -{' '}
                                            {formatCurrency(r.total_value)}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {pairs.map((pair, index) => {
                            const filteredReplacement = allVariants.filter(
                                (v) =>
                                    (v.full_name ?? v.name)
                                        .toLowerCase()
                                        .includes(
                                            pair.replacement_search.toLowerCase(),
                                        ),
                            );

                            return (
                                <div
                                    key={index}
                                    className="rounded-xl border border-border bg-white p-3"
                                >
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="text-xs font-bold tracking-wider text-text-subtle uppercase">
                                            Pasangan {index + 1}
                                        </span>
                                        {pairs.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removePair(index)
                                                }
                                                className="rounded-lg p-1.5 text-text-subtle hover:bg-red-50 hover:text-red-600"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Return side - read-only */}
                                    <div className="space-y-2.5 rounded-xl border border-red-200 bg-red-50/50 p-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                                            <span className="text-xs font-bold text-red-700">
                                                Dikembalikan
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-white/60 px-3 py-2.5 text-sm">
                                            <span className="font-medium text-red-800">
                                                {getReturnItemName(
                                                    pair.return_variant_id,
                                                )}{' '}
                                                x{pair.return_quantity}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="my-3 flex justify-center">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light">
                                            <ArrowRight className="h-4 w-4 text-primary" />
                                        </div>
                                    </div>

                                    {/* Replacement */}
                                    <div className="space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                            <span className="text-xs font-bold text-emerald-700">
                                                Pengganti
                                            </span>
                                        </div>

                                        <input
                                            type="text"
                                            placeholder="Cari produk pengganti..."
                                            value={pair.replacement_search}
                                            onChange={(e) =>
                                                updatePair(index, {
                                                    replacement_search:
                                                        e.target.value,
                                                })
                                            }
                                            className="w-full rounded-xl border border-border bg-white p-3 text-sm"
                                        />

                                        <div className="max-h-36 space-y-2 overflow-y-auto">
                                            {filteredReplacement.length ===
                                            0 ? (
                                                <div className="py-3 text-center text-xs text-text-muted">
                                                    Tidak ada produk
                                                </div>
                                            ) : (
                                                filteredReplacement.map((v) => {
                                                    const isSelected =
                                                        pair.replacement_variant_id ===
                                                        v.id;

                                                    return (
                                                        <div
                                                            key={v.id}
                                                            className={`rounded-xl border p-3 transition-colors ${isSelected ? 'border-primary bg-primary-light' : 'border-border bg-white'}`}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    updatePair(
                                                                        index,
                                                                        {
                                                                            replacement_variant_id:
                                                                                isSelected
                                                                                    ? 0
                                                                                    : v.id,
                                                                            replacement_quantity: 1,
                                                                        },
                                                                    )
                                                                }
                                                                className="flex min-h-11 w-full items-center gap-3 text-left"
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
                                                                        {v.full_name ??
                                                                            v.name}
                                                                    </div>
                                                                    <div className="text-xs text-text-muted">
                                                                        {v.selling_price
                                                                            ? formatCurrency(
                                                                                  v.selling_price,
                                                                              )
                                                                            : ''}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                            {isSelected && (
                                                                <div className="mt-2 flex items-center justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            updateReplacementQty(
                                                                                index,
                                                                                pair.replacement_quantity -
                                                                                    1,
                                                                            )
                                                                        }
                                                                        className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-text-muted"
                                                                    >
                                                                        <Minus className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <input
                                                                        type="number"
                                                                        min={1}
                                                                        value={
                                                                            pair.replacement_quantity
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateReplacementQty(
                                                                                index,
                                                                                Number(
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                ),
                                                                            )
                                                                        }
                                                                        className="w-14 [appearance:textfield] text-center text-sm font-bold tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            updateReplacementQty(
                                                                                index,
                                                                                pair.replacement_quantity +
                                                                                    1,
                                                                            )
                                                                        }
                                                                        className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-text-muted"
                                                                    >
                                                                        <Plus className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <div>
                            <label className="text-sm font-semibold text-text">
                                Catatan
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) =>
                                    handleNotesChange(e.target.value)
                                }
                                placeholder="Opsional"
                                className="mt-2 w-full rounded-xl border border-border p-3 text-sm"
                                rows={2}
                            />
                        </div>

                        {Object.keys(form.errors).length > 0 && (
                            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                                {Object.values(form.errors).flat().join(', ')}
                            </div>
                        )}
                    </div>

                    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-white px-4 py-3">
                        <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
                            <span>{validCount} pasangan siap</span>
                            <span>{pairs.length} total</span>
                        </div>
                        <button
                            type="submit"
                            disabled={form.processing || validCount === 0}
                            className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white transition-colors active:opacity-80 disabled:bg-border disabled:text-text-subtle"
                        >
                            {form.processing
                                ? 'Mengirim...'
                                : `Kirim Penukaran${validCount > 0 ? ` (${validCount})` : ''}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}
