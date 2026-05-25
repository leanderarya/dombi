import { Link } from '@inertiajs/react';
import { orderProgressIndex, orderStatusLabel, orderStatusTone } from '@/lib/customer-status';

interface Props {
    order: {
        id: number;
        status: string;
        outlet?: { name: string } | null;
        items?: { product_name: string; quantity: number }[];
        delivery?: { status: string; courier?: { name: string } | null } | null;
    };
}

export default function ActiveOrderCard({ order }: Props) {
    const tone = orderStatusTone[order.status] ?? 'bg-zinc-50 text-zinc-800 ring-zinc-200';
    const progress = orderProgressIndex(order.status);
    const itemSummary = order.items?.map((i) => `${i.product_name} x${i.quantity}`).join(', ') ?? '';

    return (
        <Link href={`/customer/orders/${order.id}`} className="block rounded-lg border border-zinc-100 bg-white p-4 active:bg-zinc-50">
            <div className="flex items-start justify-between gap-3">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${tone}`}>
                    {orderStatusLabel(order.status)}
                </span>
                <svg className="h-5 w-5 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
            </div>

            <div className="mt-3">
                <div className="text-sm font-semibold text-slate-900">{order.outlet?.name ?? 'Outlet sedang dipilih'}</div>
                {itemSummary && <div className="mt-0.5 truncate text-xs text-slate-500">{itemSummary}</div>}
            </div>

            {/* Progress bar */}
            <div className="mt-3 flex gap-0.5">
                {progress.steps.map((step, i) => (
                    <div key={step} className={`h-1 flex-1 rounded-full ${i <= progress.index ? 'bg-emerald-500' : 'bg-zinc-200'}`} />
                ))}
            </div>

            {/* Track CTA */}
            <div className="mt-3 flex min-h-10 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold uppercase tracking-wide text-white">
                Lacak Pesanan
            </div>
        </Link>
    );
}
