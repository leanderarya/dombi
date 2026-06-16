import { Package } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface Props {
    name: string;
    price: number | string;
    quantity: number;
    image?: string | null;
    onQuantityChange: (qty: number) => void;
    onRemove: () => void;
}

export default function CheckoutItemCard({ name, price, quantity, image, onQuantityChange, onRemove }: Props) {
    return (
        <div className="flex items-center gap-3 border-b border-zinc-50 py-3 last:border-b-0">
            {/* Thumbnail */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-50">
                {image ? (
                    <img src={image} alt={name} className="h-full w-full object-cover" />
                ) : (
                    <Package className="h-6 w-6 text-zinc-400" />
                )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight text-slate-900">{name}</div>
                <div className="mt-1 text-xs font-medium text-emerald-700">{formatCurrency(price)}</div>
            </div>

            {/* Quantity Stepper */}
            <div className="flex shrink-0 items-center">
                <button
                    type="button"
                    onClick={() => quantity > 1 ? onQuantityChange(quantity - 1) : onRemove()}
                    className="flex h-8 w-8 items-center justify-center rounded-l-lg border border-zinc-200 text-sm font-semibold text-slate-600 transition-transform active:scale-90 active:bg-zinc-50"
                    aria-label="Kurangi"
                >
                    −
                </button>
                <span className="flex h-8 w-8 items-center justify-center border-y border-zinc-200 text-xs font-bold tabular-nums text-slate-900">
                    {quantity}
                </span>
                <button
                    type="button"
                    onClick={() => onQuantityChange(quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-r-lg border border-emerald-600 bg-emerald-600 text-sm font-semibold text-white transition-transform active:scale-90 active:bg-emerald-700"
                    aria-label="Tambah"
                >
                    +
                </button>
            </div>
        </div>
    );
}
