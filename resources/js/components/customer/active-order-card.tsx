import { Link } from '@inertiajs/react';
import { Truck } from 'lucide-react';
import OrderTimeline from '@/components/customer/order-timeline';
import { orderStatusLabel, orderStatusTone } from '@/lib/customer-status';
import { formatCurrency } from '@/lib/format';

interface Props {
    order: {
        id: number;
        order_code: string;
        status: string;
        fulfillment_type?: string;
        total?: number;
        outlet?: { name: string } | null;
        items?: { product_name: string; quantity: number }[];
        delivery?: { status: string; courier?: { name: string } | null } | null;
    };
}

export default function ActiveOrderCard({ order }: Props) {
    const tone = orderStatusTone[order.status] ?? 'bg-zinc-50 text-zinc-800 ring-zinc-200';
    const itemSummary = order.items?.map((i) => `${i.product_name} x${i.quantity}`).join(', ') ?? '';

    return (
        <Link href={`/customer/orders/${order.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[11px] font-bold text-slate-400">{order.order_code}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{order.outlet?.name ?? 'Outlet sedang dipilih'}</div>
                </div>
                <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${tone}`}>
                    {orderStatusLabel(order.status)}
                </span>
            </div>

            {/* Items */}
            {itemSummary && (
                <div className="mt-2 truncate text-xs text-slate-500">{itemSummary}</div>
            )}

            {/* Timeline Preview */}
            <div className="mt-3">
                <OrderTimeline
                    currentStatus={order.status}
                    fulfillmentType={order.fulfillment_type}
                    compact
                />
            </div>

            {/* Total + CTA */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                {order.total !== undefined && (
                    <div className="text-sm font-bold tabular-nums text-slate-900">{formatCurrency(order.total)}</div>
                )}
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white">
                    <Truck className="h-3.5 w-3.5" />
                    Lacak Pesanan
                </div>
            </div>
        </Link>
    );
}
