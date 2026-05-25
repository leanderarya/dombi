import { memo, useCallback } from 'react';
import { useCart, useProductQuantity } from '@/lib/use-cart';
import { formatCurrency } from '@/lib/format';

interface Product {
    id: number;
    name: string;
    size?: string | null;
    unit?: string;
    price: number | string;
    image?: string | null;
    is_active?: boolean;
}

interface Props {
    product: Product;
    compact?: boolean;
}

const ProductCard = memo(function ProductCard({ product, compact = false }: Props) {
    const qty = useProductQuantity(product.id);
    const { addItem, setQuantity } = useCart();
    const outOfStock = product.is_active === false;

    const handleAdd = useCallback(() => addItem(product.id), [addItem, product.id]);
    const handleIncrement = useCallback(() => setQuantity(product.id, qty + 1), [setQuantity, product.id, qty]);
    const handleDecrement = useCallback(() => setQuantity(product.id, qty - 1), [setQuantity, product.id, qty]);

    return (
        <div className="overflow-hidden rounded-lg border border-zinc-100 bg-white">
            {/* Image area */}
            <div className="relative aspect-square bg-zinc-50">
                {product.image ? (
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <span className="text-3xl opacity-30">🥛</span>
                    </div>
                )}

                {/* Add / Stepper overlay */}
                <div className="absolute bottom-2 right-2">
                    {outOfStock ? (
                        <span className="rounded-md bg-zinc-200 px-2 py-1 text-[10px] font-bold text-zinc-500">Habis</span>
                    ) : qty === 0 ? (
                        <AddButton onAdd={handleAdd} />
                    ) : (
                        <InlineStepper qty={qty} onIncrement={handleIncrement} onDecrement={handleDecrement} />
                    )}
                </div>
            </div>

            {/* Info */}
            <div className="p-3">
                <div className="line-clamp-2 min-h-9 text-sm font-semibold leading-[1.15rem] text-slate-900">
                    {product.name}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-emerald-700">
                    {formatCurrency(product.price)}
                </div>
            </div>
        </div>
    );
});

export default ProductCard;

/** Isolated add button — prevents parent re-render on press animation */
function AddButton({ onAdd }: { onAdd: () => void }) {
    return (
        <button
            type="button"
            onClick={onAdd}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-lg leading-none text-slate-700 shadow-sm transition-transform active:scale-90"
            aria-label="Tambah ke keranjang"
        >
            +
        </button>
    );
}

/** Inline quantity stepper — fully local, no server calls */
function InlineStepper({ qty, onIncrement, onDecrement }: { qty: number; onIncrement: () => void; onDecrement: () => void }) {
    return (
        <div className="flex items-center rounded-md border border-emerald-200 bg-white shadow-sm">
            <button
                type="button"
                onClick={onDecrement}
                className="flex h-8 w-8 items-center justify-center text-base font-semibold text-emerald-700 transition-transform active:scale-90 active:bg-emerald-50"
                aria-label="Kurangi"
            >
                −
            </button>
            <span className="flex h-8 w-7 items-center justify-center text-xs font-bold tabular-nums text-slate-900">
                {qty}
            </span>
            <button
                type="button"
                onClick={onIncrement}
                className="flex h-8 w-8 items-center justify-center text-base font-semibold text-emerald-700 transition-transform active:scale-90 active:bg-emerald-50"
                aria-label="Tambah"
            >
                +
            </button>
        </div>
    );
}
