import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';

interface Props {
    name: string;
    price: number | string;
    quantity: number;
    image?: string | null;
    onQuantityChange: (qty: number) => void;
    onRemove: () => void;
}

export default function CheckoutItemCard({
    name,
    price,
    quantity,
    image,
    onQuantityChange,
    onRemove,
}: Props) {
    const unitPrice = Number(price);
    const subtotal = unitPrice * quantity;

    return (
        <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0 active:bg-surface-muted">
            {/* Thumbnail */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-chip bg-surface">
                {image ? (
                    <img
                        src={image}
                        alt={name}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <span aria-hidden="true" className="text-2xl leading-none">
                        &#x1F95B;
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="text-sm leading-tight font-semibold text-text">
                    {name}
                </div>
                <div className="mt-0.5 text-xs text-text-muted">
                    {formatCurrency(unitPrice)} × {quantity}
                </div>
                <div className="mt-0.5 text-sm font-bold text-text tabular-nums">
                    {formatCurrency(subtotal)}
                </div>
            </div>

            {/* Quantity Stepper */}
            <div className="flex shrink-0 items-center">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                        quantity > 1
                            ? onQuantityChange(quantity - 1)
                            : onRemove()
                    }
                    className="min-h-11 min-w-11 rounded-l-chip border-border px-2 text-sm font-semibold text-text"
                    aria-label="Kurangi"
                >
                    −
                </Button>
                <span className="flex min-h-11 min-w-11 items-center justify-center border-y border-border px-2 text-xs font-bold text-text tabular-nums">
                    {quantity}
                </span>
                <Button
                    type="button"
                    variant="primary"
                    onClick={() => onQuantityChange(quantity + 1)}
                    className="min-h-11 min-w-11 rounded-r-chip border border-primary bg-primary px-2 text-sm font-semibold"
                    aria-label="Tambah"
                >
                    +
                </Button>
            </div>
        </div>
    );
}
