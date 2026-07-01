import { Link } from '@inertiajs/react';
import { Package, RotateCcw } from 'lucide-react';
import { orderStatusLabel, orderStatusTone, isTerminalOrder } from '@/lib/customer-status';
import { formatCurrency, formatRelativeDate } from '@/lib/format';

interface OrderItem {
    product_name: string;
    quantity: number;
}

interface Props {
    order: {
        id: number;
        order_code: string;
        recovery_token?: string;
        tracking_url?: string;
        status: string;
        total: number | string;
        created_at?: string;
        outlet?: { id: number; name: string } | null;
        items?: OrderItem[];
    };
}

export default function OrderHistoryCard({ order }: Props) {
    const tone = orderStatusTone[order.status] ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200';
    const itemCount = order.items?.length ?? 0;
    const itemSummary = order.items?.map((i) => i.product_name).join(', ') ?? '';
    const dateStr = formatRelativeDate(order.created_at);
    const isTerminal = isTerminalOrder(order.status);
    const detailHref = `/customer/orders/${order.id}`;

    return (
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            {/* Header: code + status */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-text-subtle">{order.order_code}</div>
                    <div className="mt-0.5 text-sm font-semibold text-text truncate">{order.outlet?.name ?? '-'}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone}`}>
                    {orderStatusLabel(order.status)}
                </span>
            </div>

            {/* Body: items + date */}
            <div className="mt-2 flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                    <Package className="h-4 w-4 text-text-subtle" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-xs text-text-muted truncate">
                        {itemCount} Item{itemCount > 1 ? 's' : ''}: {itemSummary}
                    </div>
                    <div className="mt-0.5 text-[11px] text-text-subtle">{dateStr}</div>
                </div>
            </div>

            {/* Footer: total + actions */}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                <div className="text-sm font-bold tabular-nums text-text">{formatCurrency(order.total)}</div>
                <div className="flex gap-2">
                    <Link
                        href={detailHref}
                        className="flex min-h-9 items-center rounded-lg bg-text px-4 text-xs font-semibold text-white active:bg-text/90"
                    >
                        Detail
                    </Link>
                    {isTerminal && (
                        <Link
                            href={`/customer/orders/${order.id}/restore-cart`}
                            className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-4 text-xs font-semibold text-text active:bg-surface-muted"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Pesan Lagi
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
