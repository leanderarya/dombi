import { Link } from '@inertiajs/react';
import { orderStatusLabel } from '@/lib/customer-status';
import { formatCurrency, formatDate } from '@/lib/format';
import { getOrderStatusTone } from '@/lib/status-labels';

interface Props {
    order: {
        id: number;
        order_code: string;
        status: string;
        total: number | string;
        created_at?: string;
        outlet?: { id: number; name: string } | null;
    };
    showReorder?: boolean;
}

export default function OrderCard({ order, showReorder = false }: Props) {
    const tone = getOrderStatusTone(order.status);

    return (
        <div className="rounded-lg border border-border bg-white p-4">
            <Link href={`/customer/orders/${order.id}`} className="block active:opacity-80">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-text">{order.order_code}</div>
                        <div className="mt-0.5 text-xs text-text-muted">{order.outlet?.name ?? '-'} · {formatDate(order.created_at)}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${tone}`}>
                        {orderStatusLabel(order.status)}
                    </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-text-subtle">Total</span>
                    <span className="text-sm font-semibold text-text">{formatCurrency(order.total)}</span>
                </div>
            </Link>
            {showReorder && (
                <Link
                    href={`/customer/orders/${order.id}/restore-cart`}
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800 active:bg-emerald-100"
                >
                    Order ulang
                </Link>
            )}
        </div>
    );
}
