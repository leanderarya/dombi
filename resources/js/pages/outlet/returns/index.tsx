import { Head, Link, router } from '@inertiajs/react';
import Pagination from '@/components/pagination';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';
import { getReturnStatus } from '@/lib/status-labels';

export default function OutletReturnsIndex({ returns, filters }: any) {
    return (
        <OutletLayout title="Return Saya" subtitle="Pengajuan return produk outlet">
            <Head title="Return Saya" />

            <div>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[22px] font-bold leading-7 text-slate-950">Return Saya</h1>
                        <p className="mt-1 text-xs text-slate-500">Return produk tidak terjual atau rusak.</p>
                    </div>
                    <Link
                        href="/outlet/returns/create"
                        className="flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white active:bg-emerald-700"
                    >
                        + Ajukan Return
                    </Link>
                </div>

                <Link
                    href="/outlet/exchanges"
                    className="mt-3 flex min-h-11 items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 active:bg-emerald-100"
                >
                    <span>Lihat Tukar Produk</span>
                    <span className="text-xs">Exchange →</span>
                </Link>

                {/* Filter */}
                <div className="mt-4 flex gap-2 overflow-x-auto">
                    {['all', 'submitted', 'approved', 'rejected', 'received_at_center', 'completed'].map((status) => (
                        <button
                            key={status}
                            onClick={() => router.get('/outlet/returns', status === 'all' ? {} : { status }, { preserveState: true, replace: true })}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                (status === 'all' && !filters.status) || filters.status === status
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600'
                            }`}
                        >
                            {status === 'all' ? 'Semua' : getReturnStatus(status).label}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="mt-4 space-y-3">
                    {returns.data.length === 0 && (
                        <div className="py-12 text-center text-sm text-zinc-500">Belum ada return request.</div>
                    )}
                    {returns.data.map((ret: any) => {
                        const status = getReturnStatus(ret.status);

                        return (
                            <Link
                                key={ret.id}
                                href={`/outlet/returns/${ret.id}`}
                                className="block rounded-xl border border-zinc-100 bg-white p-4 active:bg-zinc-50"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="text-sm font-semibold text-slate-900">Return #{ret.id}</div>
                                    <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                                    <span>{ret.items?.length ?? 0} item</span>
                                    <span className="font-semibold text-slate-900">{formatCurrency(ret.total_value)}</span>
                                </div>
                                <div className="mt-1 text-[11px] text-zinc-400">{formatDate(ret.created_at)}</div>
                            </Link>
                        );
                    })}
                </div>

                <Pagination links={returns.links} />
                <div className="h-24" />
            </div>
        </OutletLayout>
    );
}
