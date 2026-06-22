import { formatCurrency } from '@/lib/format';

interface OrderItem {
    id: number;
    product_name: string;
    quantity: number;
    price: number | string;
    subtotal: number | string;
}

interface Props {
    items: OrderItem[];
    subtotal: number | string;
    deliveryFee: number | string;
    total: number | string;
}

export default function OrderSummaryCard({ items, subtotal, deliveryFee, total }: Props) {
    return (
        <div className="rounded-2xl border border-border bg-white p-4">
            <div className="text-[13px] text-text-subtle">Order Summary</div>
            <div className="mt-3 space-y-2.5">
                {items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0 text-sm text-text">
                            <span className="font-medium">{item.product_name}</span>
                            <span className="ml-1 text-text-muted">x{item.quantity}</span>
                        </div>
                        <span className="shrink-0 text-sm tabular-nums text-text">{formatCurrency(item.subtotal)}</span>
                    </div>
                ))}
            </div>
            {Number(deliveryFee) > 0 && (
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-sm text-text-muted">Ongkir</span>
                    <span className="text-sm tabular-nums text-text">{formatCurrency(deliveryFee)}</span>
                </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold text-text">Total Dibayar</span>
                <span className="text-base font-bold tabular-nums text-primary">{formatCurrency(total)}</span>
            </div>
        </div>
    );
}
