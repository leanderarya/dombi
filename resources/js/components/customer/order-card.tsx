import { Link } from '@inertiajs/react';
import { orderStatusLabel, orderStatusTone } from '@/lib/customer-status';
import { formatCurrency, formatDate } from '@/lib/format';

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
    const tone = orderStatusTone[order.status] ?? 'bg-zinc-50 text-zinc-700 ring-zinc-200';

    return (
        <div className="rounded-lg border border-zinc-100 bg-white p-4">
            <Link href={`/customer/orders/${order.id}`} className="block active:opacity-80">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{order.order_code}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{order.outlet?.name ?? '-'} · {formatDate(order.created_at)}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${tone}`}>
                        {orderStatusLabel(order.status)}
                    </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-zinc-50 pt-3">
                    <span className="text-xs text-slate-400">Total</span>
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(order.total)}</span>
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
