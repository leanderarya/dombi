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
    const unitPrice = Number(price);
    const subtotal = unitPrice * quantity;

    return (
        <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
            {/* Thumbnail */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
                {image ? (
                    <img src={image} alt={name} className="h-full w-full object-cover" />
                ) : (
                    <Package className="h-6 w-6 text-text-subtle" />
                )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight text-text">{name}</div>
                <div className="mt-0.5 text-xs text-text-muted">{formatCurrency(unitPrice)} × {quantity}</div>
                <div className="mt-0.5 text-sm font-bold tabular-nums text-text">{formatCurrency(subtotal)}</div>
            </div>

            {/* Quantity Stepper */}
            <div className="flex shrink-0 items-center">
                <button
                    type="button"
                    onClick={() => quantity > 1 ? onQuantityChange(quantity - 1) : onRemove()}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-l-lg border border-border px-2 text-sm font-semibold text-text active:opacity-80"
                    aria-label="Kurangi"
                >
                    −
                </button>
                <span className="flex min-h-[44px] min-w-[44px] items-center justify-center border-y border-border px-2 text-xs font-bold tabular-nums text-text">
                    {quantity}
                </span>
                <button
                    type="button"
                    onClick={() => onQuantityChange(quantity + 1)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-lg border border-emerald-600 bg-emerald-600 px-2 text-sm font-semibold text-white active:opacity-80"
                    aria-label="Tambah"
                >
                    +
                </button>
            </div>
        </div>
    );
}
