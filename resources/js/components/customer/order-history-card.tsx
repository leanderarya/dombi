import { Link, router } from '@inertiajs/react';
import { orderStatusLabel, orderStatusTone } from '@/lib/customer-status';
import { formatCurrency } from '@/lib/format';

interface OrderItem {
    product_name: string;
    quantity: number;
}

interface Props {
    order: {
        id: number;
        order_code: string;
        status: string;
        total: number | string;
        created_at?: string;
        outlet?: { id: number; name: string } | null;
        items?: OrderItem[];
    };
}

export default function OrderHistoryCard({ order }: Props) {
    const tone = orderStatusTone[order.status] ?? 'bg-zinc-50 text-zinc-700 ring-zinc-200';
    const itemCount = order.items?.length ?? 0;
    const itemSummary = order.items?.map((i) => i.product_name).join(', ') ?? '';
    const dateStr = order.created_at ? formatShortDate(order.created_at) : '-';

    return (
        <div className="rounded-lg border border-zinc-100 bg-white p-4">
            {/* Header: code + status */}
            <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-bold text-slate-900">{order.order_code}</div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${tone}`}>
                    {orderStatusLabel(order.status)}
                </span>
            </div>

            {/* Body: outlet + items */}
            <div className="mt-3 flex gap-3">
                {/* Image placeholder */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-50">
                    <span className="text-xl opacity-40">🥛</span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-400">{dateStr}</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900">{order.outlet?.name ?? '-'}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                        {itemCount} Item{itemCount > 1 ? 's' : ''}: {itemSummary}
                    </div>
                </div>
            </div>

            {/* Footer: total + actions */}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-50 pt-3">
                <div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Total Tagihan</div>
                    <div className="text-sm font-bold tabular-nums text-slate-900">{formatCurrency(order.total)}</div>
                </div>
                <div className="flex gap-2">
                    <Link
                        href={`/customer/orders/${order.id}`}
                        className="flex min-h-9 items-center rounded-full border border-zinc-200 px-4 text-xs font-semibold text-slate-700 active:bg-zinc-50"
                    >
                        Detail
                    </Link>
                    <button
                        onClick={() => router.post(`/customer/orders/${order.id}/repeat`)}
                        className="flex min-h-9 items-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white active:bg-emerald-800"
                    >
                        Beli Lagi
                    </button>
                </div>
            </div>
        </div>
    );
}

function formatShortDate(value: string): string {
    try {
        return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return '-';
    }
}
