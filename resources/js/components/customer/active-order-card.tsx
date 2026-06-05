import { Link } from '@inertiajs/react';
import { RotateCcw, Truck } from 'lucide-react';
import OrderTimeline from '@/components/customer/order-timeline';
import { orderStatusLabel, orderStatusTone, isTerminalOrder } from '@/lib/customer-status';
import { formatCurrency } from '@/lib/format';

interface Props {
    order: {
        id: number;
        order_code: string;
        recovery_token?: string;
        tracking_url?: string;
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
    const isTerminal = isTerminalOrder(order.status);

    const trackingHref = order.tracking_url
        ?? (order.recovery_token ? `/track/${order.recovery_token}` : null)
        ?? `/customer/orders/${order.id}`;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            {/* Header */}
            <Link href={trackingHref} className="block active:opacity-80">
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

                {/* Total */}
                {order.total !== undefined && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                        <div className="text-sm font-bold tabular-nums text-slate-900">{formatCurrency(order.total)}</div>
                    </div>
                )}
            </Link>

            {/* CTA */}
            <div className="mt-3 border-t border-slate-100 pt-3">
                {isTerminal ? (
                    <Link
                        href={`/customer/orders/${order.id}/restore-cart`}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white active:bg-emerald-800"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Pesan Lagi
                    </Link>
                ) : (
                    <Link
                        href={trackingHref}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white"
                    >
                        <Truck className="h-3.5 w-3.5" />
                        Lacak Pesanan
                    </Link>
                )}
            </div>
        </div>
    );
}
