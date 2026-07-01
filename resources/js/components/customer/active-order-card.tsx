import { Link, usePage } from '@inertiajs/react';
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
    const { auth } = usePage<any>().props;
    const tone = orderStatusTone[order.status] ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200';
    const itemSummary = order.items?.map((i) => `${i.product_name} x${i.quantity}`).join(', ') ?? '';
    const isTerminal = isTerminalOrder(order.status);

    // Guest users use public track page, authenticated users use customer order detail
    const trackingHref = auth?.user
        ? `/customer/orders/${order.id}`
        : `/track/${order.recovery_token}`;

    return (
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            {/* Header */}
            <Link href={trackingHref} className="block active:opacity-80">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-text-subtle">{order.order_code}</div>
                        <div className="mt-0.5 text-sm font-semibold text-text">{order.outlet?.name ?? 'Outlet sedang dipilih'}</div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone}`}>
                        {orderStatusLabel(order.status)}
                    </span>
                </div>

                {/* Items */}
                {itemSummary && (
                    <div className="mt-2 truncate text-xs text-text-muted">{itemSummary}</div>
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
                    <div className="mt-3 border-t border-border pt-3">
                        <div className="text-sm font-bold tabular-nums text-text">{formatCurrency(order.total)}</div>
                    </div>
                )}
            </Link>

            {/* CTA */}
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <Link
                    href={trackingHref}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-text px-3 py-2.5 text-xs font-semibold text-white active:bg-text/90"
                >
                    <Truck className="h-3.5 w-3.5" />
                    Lacak Pesanan
                </Link>
                {isTerminal && (
                    <Link
                        href={`/customer/orders/${order.id}/restore-cart`}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs font-semibold text-text active:bg-surface-muted"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Pesan Lagi
                    </Link>
                )}
            </div>
        </div>
    );
}
