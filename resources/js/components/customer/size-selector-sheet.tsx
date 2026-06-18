import { useEffect, useMemo, useState } from 'react';
import Dialog from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/format';
import { sizeToMl } from '@/lib/size';
import { useCart } from '@/lib/use-cart';

interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    selling_price: number;
    is_active: boolean;
    available_stock?: number;
    stock_status?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    familyName: string;
    flavorName: string;
    variants: Variant[];
    onAdded?: () => void;
}

export default function SizeSelectorSheet({ open, onClose, familyName, flavorName, variants, onAdded }: Props) {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [adding, setAdding] = useState(false);

    const cart = useCart();

    const sortedVariants = useMemo(() => {
        return [...variants].sort((a, b) => sizeToMl(a.size) - sizeToMl(b.size));
    }, [variants]);

    // Reset selection to smallest when sheet opens
    useEffect(() => {
        if (open && sortedVariants.length > 0) {
            setSelectedId(sortedVariants[0].id);
            setQuantity(1);
        }
    }, [open, sortedVariants]);

    const selectedVariant = sortedVariants.find((v) => v.id === selectedId) ?? sortedVariants[0];
    const isOutOfStock = selectedVariant?.stock_status === 'out_of_stock';

    const handleAdd = async () => {
        if (!selectedVariant || adding || isOutOfStock) {
return;
}

        setAdding(true);
        cart.addItem(selectedVariant.id, quantity);

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            await fetch('/customer/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({
                    product_variant_id: selectedVariant.id,
                    quantity,
                }),
                credentials: 'same-origin',
            });
        } catch {
            // Frontend cart already updated
        }

        setAdding(false);
        setQuantity(1);
        onAdded?.();
        onClose();
    };

    const title = flavorName
        ? `${familyName} ${flavorName}`
        : familyName;

    return (
        <Dialog open={open} onClose={onClose} title={title}>
            <div className="space-y-5">

                {/* Size Options */}
                <div className="space-y-2">
                    {sortedVariants.map((variant) => {
                        const isSelected = selectedVariant?.id === variant.id;
                        const outOfStock = variant.stock_status === 'out_of_stock';

                        return (
                            <button
                                key={variant.id}
                                onClick={() => setSelectedId(variant.id)}
                                disabled={outOfStock}
                                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] disabled:opacity-40 ${
                                    isSelected
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-zinc-200 bg-white'
                                }`}
                            >
                                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                    isSelected ? 'border-emerald-600' : 'border-zinc-300'
                                }`}>
                                    {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-900">{variant.size ?? variant.name}</div>
                                </div>
                                <div className="text-sm font-bold tabular-nums text-slate-900">
                                    {formatCurrency(variant.selling_price)}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Quantity + Add */}
                {selectedVariant && (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center rounded-xl border border-zinc-200 bg-white">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="flex h-11 w-11 items-center justify-center text-zinc-600 active:bg-zinc-50 rounded-l-xl"
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" d="M5 12h14" />
                                </svg>
                            </button>
                            <span className="w-10 text-center text-sm font-bold text-slate-900">{quantity}</span>
                            <button
                                onClick={() => setQuantity(quantity + 1)}
                                className="flex h-11 w-11 items-center justify-center text-zinc-600 active:bg-zinc-50 rounded-r-xl"
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                                </svg>
                            </button>
                        </div>

                        <button
                            onClick={handleAdd}
                            disabled={adding || isOutOfStock}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:bg-emerald-700 shadow-sm disabled:opacity-60"
                        >
                            {isOutOfStock ? (
                                'Habis'
                            ) : (
                                <>
                                    <span>{adding ? 'Menambahkan...' : 'Tambah'}</span>
                                    <span className="text-white/80">&middot;</span>
                                    <span>{formatCurrency(selectedVariant.selling_price * quantity)}</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
