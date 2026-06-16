import { Link, router } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { getReturnStatus } from '@/lib/status-labels';

export default function OwnerReturnsIndex({ returns, filters, dashboard, outlets, reasons }: any) {
    return (
        <OwnerPageShell title="Permintaan Return">

            <div className="space-y-6">
                {/* Dashboard Metrics */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-zinc-100 bg-white p-4">
                        <div className="text-xs text-zinc-500">Return Tertunda</div>
                        <div className="mt-1 text-2xl font-bold text-slate-900">{dashboard.pending_returns}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-100 bg-white p-4">
                        <div className="text-xs text-zinc-500">Nilai Return</div>
                        <div className="mt-1 text-2xl font-bold text-emerald-700">{formatCurrency(dashboard.returned_value)}</div>
                    </div>
                </div>

                {/* Filter */}
                <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-4">
                        <select
                            value={filters.outlet_id ?? ''}
                            onChange={(e) => router.get('/owner/returns', { ...filters, outlet_id: e.target.value || undefined }, { preserveState: true, replace: true })}
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        >
                            <option value="">Semua Outlet</option>
                            {outlets.map((outlet: any) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                        </select>
                        <select
                            value={filters.reason ?? ''}
                            onChange={(e) => router.get('/owner/returns', { ...filters, reason: e.target.value || undefined }, { preserveState: true, replace: true })}
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        >
                            <option value="">Semua Alasan</option>
                            {Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{String(label)}</option>)}
                        </select>
                        <input
                            type="date"
                            value={filters.date_from ?? ''}
                            onChange={(e) => router.get('/owner/returns', { ...filters, date_from: e.target.value || undefined }, { preserveState: true, replace: true })}
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        />
                        <input
                            type="date"
                            value={filters.date_to ?? ''}
                            onChange={(e) => router.get('/owner/returns', { ...filters, date_to: e.target.value || undefined }, { preserveState: true, replace: true })}
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto">
                    {['all', 'submitted', 'approved', 'rejected', 'received_at_center', 'completed'].map((status) => (
                        <button
                            key={status}
                            onClick={() => router.get('/owner/returns', { ...filters, status: status === 'all' ? undefined : status }, { preserveState: true, replace: true })}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                (status === 'all' && !filters.status) || filters.status === status
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                            {status === 'all' ? 'Semua' : getReturnStatus(status).label}
                        </button>
                    ))}
                    </div>
                </div>

                {/* List */}
                <div className="space-y-3">
                    {returns.data.length === 0 && (
                        <div className="py-12 text-center text-sm text-zinc-500">Tidak ada permintaan return.</div>
                    )}
                    {returns.data.map((ret: any) => {
                        const status = getReturnStatus(ret.status);

                        return (
                            <Link
                                key={ret.id}
                                href={`/owner/returns/${ret.id}`}
                                className="block rounded-xl border border-zinc-100 bg-white p-4 transition-colors active:bg-zinc-50"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">Return #{ret.id}</div>
                                        <div className="mt-0.5 text-xs text-zinc-500">{ret.outlet?.name}</div>
                                        <div className="mt-1 text-[11px] text-zinc-400">{ret.reason?.replaceAll('_', ' ')}</div>
                                    </div>
                                    <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                                    <span>{ret.items?.length ?? 0} item</span>
                                    <span className="font-semibold text-slate-900">{formatCurrency(ret.total_value)}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                                    <span>{formatDate(ret.created_at)}</span>
                                    <span className="font-semibold text-emerald-700">Tinjau</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                <Pagination links={returns.links} />
            </div>
        </OwnerPageShell>
    );
}
