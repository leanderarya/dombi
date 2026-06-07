import { Head, Link, router } from '@inertiajs/react';
import OutletLayout from '@/layouts/outlet-layout';
import StatusBadge from '@/components/ui/status-badge';
import Pagination from '@/components/pagination';
import { getExchangeStatus } from '@/lib/status-labels';
import { formatCurrency, formatDate } from '@/lib/format';

export default function OutletExchangesIndex({ exchanges, filters }: any) {
    return (
        <OutletLayout title="Tukar Produk" subtitle="Pantau penggantian produk outlet">
            <Head title="Tukar Produk" />

            <div>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[22px] font-bold leading-7 text-slate-950">Tukar Produk</h1>
                        <p className="mt-1 text-xs text-slate-500">Ajukan dan pantau produk pengganti.</p>
                    </div>
                    <Link
                        href="/outlet/exchanges/create"
                        className="flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white active:bg-emerald-700"
                    >
                        + Ajukan Tukar
                    </Link>
                </div>

                <div className="mt-4 flex gap-2 overflow-x-auto">
                    {['all', 'submitted', 'approved', 'preparing', 'shipped', 'received', 'completed', 'rejected'].map((status) => (
                        <button
                            key={status}
                            onClick={() => router.get('/outlet/exchanges', status === 'all' ? {} : { status }, { preserveState: true, replace: true })}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                (status === 'all' && !filters.status) || filters.status === status
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600'
                            }`}
                        >
                            {status === 'all' ? 'Semua' : getExchangeStatus(status).label}
                        </button>
                    ))}
                </div>

                <div className="mt-4 space-y-3">
                    {exchanges.data.length === 0 && (
                        <div className="py-12 text-center text-sm text-zinc-500">Belum ada exchange request.</div>
                    )}
                    {exchanges.data.map((ex: any) => {
                        const status = getExchangeStatus(ex.status);
                        return (
                            <Link
                                key={ex.id}
                                href={`/outlet/exchanges/${ex.id}`}
                                className="block rounded-xl border border-zinc-100 bg-white p-4 active:bg-zinc-50"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="text-sm font-semibold text-slate-900">Exchange #{ex.id}</div>
                                    <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                                    <span>{ex.items?.length ?? 0} item pengganti</span>
                                    <span className="font-semibold text-slate-900">{formatCurrency(ex.exchange_value)}</span>
                                </div>
                                <div className="mt-1 text-[11px] text-zinc-400">{formatDate(ex.created_at)}</div>
                            </Link>
                        );
                    })}
                </div>

                <Pagination links={exchanges.links} />
                <div className="h-24" />
            </div>
        </OutletLayout>
    );
}
