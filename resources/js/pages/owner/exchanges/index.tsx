import { Link, router } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { getExchangeStatus } from '@/lib/status-labels';

export default function OwnerExchangesIndex({ exchanges, filters, dashboard, outlets, reasons }: any) {
    return (
        <OwnerPageShell title="Permintaan Tukar Produk">

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-zinc-100 bg-white p-4">
                        <div className="text-xs text-zinc-500">Tukar Produk Tertunda</div>
                        <div className="mt-1 text-2xl font-bold text-slate-900">{dashboard.pending_exchanges}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-100 bg-white p-4">
                        <div className="text-xs text-zinc-500">Nilai Tukar</div>
                        <div className="mt-1 text-2xl font-bold text-emerald-700">{formatCurrency(dashboard.exchange_value)}</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-4">
                        <select
                            value={filters.outlet_id ?? ''}
                            onChange={(e) => router.get('/owner/exchanges', { ...filters, outlet_id: e.target.value || undefined }, { preserveState: true, replace: true })}
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        >
                            <option value="">Semua Outlet</option>
                            {outlets.map((outlet: any) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                        </select>
                        <select
                            value={filters.reason ?? ''}
                            onChange={(e) => router.get('/owner/exchanges', { ...filters, reason: e.target.value || undefined }, { preserveState: true, replace: true })}
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        >
                            <option value="">Semua Alasan</option>
                            {Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{String(label)}</option>)}
                        </select>
                        <input
                            type="date"
                            value={filters.date_from ?? ''}
                            onChange={(e) => router.get('/owner/exchanges', { ...filters, date_from: e.target.value || undefined }, { preserveState: true, replace: true })}
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        />
                        <input
                            type="date"
                            value={filters.date_to ?? ''}
                            onChange={(e) => router.get('/owner/exchanges', { ...filters, date_to: e.target.value || undefined }, { preserveState: true, replace: true })}
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto">
                    {['all', 'submitted', 'approved', 'preparing', 'shipped', 'received', 'completed', 'rejected'].map((status) => (
                        <button
                            key={status}
                            onClick={() => router.get('/owner/exchanges', { ...filters, status: status === 'all' ? undefined : status }, { preserveState: true, replace: true })}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                (status === 'all' && !filters.status) || filters.status === status
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                            {status === 'all' ? 'Semua' : getExchangeStatus(status).label}
                        </button>
                    ))}
                    </div>
                </div>

                <div className="space-y-3">
                    {exchanges.data.length === 0 && (
                        <div className="py-12 text-center text-sm text-zinc-500">Tidak ada permintaan tukar produk.</div>
                    )}
                    {exchanges.data.map((ex: any) => {
                        const status = getExchangeStatus(ex.status);

                        return (
                            <Link
                                key={ex.id}
                                href={`/owner/exchanges/${ex.id}`}
                                className="block rounded-xl border border-zinc-100 bg-white p-4 transition-colors active:bg-zinc-50"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">Exchange #{ex.id}</div>
                                        <div className="mt-0.5 text-xs text-zinc-500">{ex.outlet?.name}</div>
                                        <div className="mt-1 text-[11px] text-zinc-400">
                                            {ex.return_request_id ? `Return #${ex.return_request_id}` : 'Tanpa return terkait'}
                                        </div>
                                    </div>
                                    <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                                    <span>{ex.items?.length ?? 0} item</span>
                                    <span className="font-semibold text-slate-900">{formatCurrency(ex.exchange_value)}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                                    <span>{formatDate(ex.created_at)}</span>
                                    <span className="font-semibold text-emerald-700">Tinjau</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                <Pagination links={exchanges.links} />
            </div>
        </OwnerPageShell>
    );
}
