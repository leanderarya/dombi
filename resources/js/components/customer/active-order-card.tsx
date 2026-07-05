import { Link, usePage } from '@inertiajs/react';
import { Truck } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface Props {
    order: {
        id: number;
        order_code: string;
        status: string;
        fulfillment_type?: string;
        total?: number;
        recovery_token?: string;
        outlet?: { name: string } | null;
        items?: { product_name: string; quantity: number }[];
    };
}

const STATUS_LABELS: Record<string, string> = {
    pending_confirmation: 'Menunggu',
    confirmed: 'Dikonfirmasi',
    preparing: 'Disiapkan',
    ready_for_pickup: 'Siap Diambil',
    out_for_delivery: 'Dalam Perjalanan',
};

export default function ActiveOrderCard({ order }: Props) {
    const { auth } = usePage<any>().props;
    const isPickup = order.fulfillment_type !== 'delivery_dombi';
    const itemCount = order.items?.length ?? 0;
    const firstItem = order.items?.[0];

    const trackingHref = auth?.user
        ? `/customer/orders/${order.id}`
        : `/track/${order.recovery_token}`;

    return (
        <Link
            href={trackingHref}
            className="block rounded-2xl border-2 border-primary/30 bg-white p-4 shadow-sm active:opacity-80"
        >
            {/* Header */}
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                    <Truck className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text">{isPickup ? 'Pick Up' : 'Delivery'}</span>
                        <span className="fore-badge-success">{STATUS_LABELS[order.status] ?? 'Aktif'}</span>
                    </div>
                    <div className="text-[11px] text-text-muted">{order.order_code} · {order.outlet?.name ?? 'Outlet'}</div>
                </div>
            </div>

            {/* Product */}
            {firstItem && (
                <div className="mt-3 text-xs text-text-muted">
                    {firstItem.product_name}
                    {itemCount > 1 && ` +${itemCount - 1} lainnya`}
                </div>
            )}

            {/* Total */}
            {order.total !== undefined && (
                <div className="mt-2 text-sm font-bold tabular-nums text-text">{formatCurrency(order.total)}</div>
            )}

            {/* CTA */}
            <div className="mt-3 rounded-lg bg-primary px-3 py-2.5 text-center text-xs font-bold text-white">
                Lacak Pesanan
            </div>
        </Link>
    );
}
