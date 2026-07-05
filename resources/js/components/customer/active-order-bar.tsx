import { Link } from '@inertiajs/react';
import { orderStatusLabel } from '@/lib/customer-status';

interface Props {
    order?: any;
}

export default function ActiveOrderBar({ order }: Props) {
    if (!order) {
return null;
}

    return (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0))] z-30 px-4">
            <Link
                href={`/customer/orders/${order.id}`}
                className="mx-auto flex max-w-lg items-center gap-3 rounded-xl bg-text px-4 py-3 shadow-lg active:bg-text/90"
            >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20">
                    <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">Order aktif</div>
                    <div className="truncate text-sm font-semibold text-white">{orderStatusLabel(order.status)}</div>
                </div>
                <span className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
                    Lacak
                </span>
            </Link>
        </div>
    );
}
