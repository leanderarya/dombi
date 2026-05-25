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
        <div className="rounded-lg border border-zinc-100 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Order Summary</div>
            <div className="mt-3 space-y-2.5">
                {items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0 text-sm text-slate-700">
                            <span className="font-medium">{item.product_name}</span>
                            <span className="ml-1 text-slate-400">x{item.quantity}</span>
                        </div>
                        <span className="shrink-0 text-sm tabular-nums text-slate-700">{formatCurrency(item.subtotal)}</span>
                    </div>
                ))}
            </div>
            {Number(deliveryFee) > 0 && (
                <div className="mt-3 flex items-center justify-between border-t border-zinc-50 pt-3">
                    <span className="text-sm text-slate-500">Ongkir</span>
                    <span className="text-sm tabular-nums text-slate-700">{formatCurrency(deliveryFee)}</span>
                </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                <span className="text-sm font-semibold text-slate-900">Total Dibayar</span>
                <span className="text-base font-bold tabular-nums text-emerald-700">{formatCurrency(total)}</span>
            </div>
        </div>
    );
}
