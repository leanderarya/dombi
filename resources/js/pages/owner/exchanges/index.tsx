import { Link, router } from '@inertiajs/react';
import { ArrowDownRight, ArrowLeftRight, Package, TrendingUp } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_BORDER } from '@/lib/status-border';
import { getExchangeStatus } from '@/lib/status-labels';

export default function OwnerExchangesIndex({ exchanges, filters, dashboard, outlets, reasons }: any) {
    const handleApprove = (id: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.post(`/owner/exchanges/${id}/approve`, {}, { preserveScroll: true });
    };

    return (
        <OwnerPageShell title="Permintaan Tukar Produk" subtitle="Kelola penukaran barang dari outlet">

            <div className="space-y-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:space-y-0">
                {/* Left: Filters + List */}
                <div className="space-y-4">
                    {/* Filter Controls */}
                    <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-4">
                            <Select
                                value={filters.outlet_id ?? ''}
                                onChange={(e) => router.get('/owner/exchanges', { ...filters, outlet_id: e.target.value || undefined }, { preserveState: true, replace: true })}
                                options={outlets.map((outlet: any) => ({ value: String(outlet.id), label: outlet.name }))}
                                placeholder="Semua Outlet"
                            />
                            <Select
                                value={filters.reason ?? ''}
                                onChange={(e) => router.get('/owner/exchanges', { ...filters, reason: e.target.value || undefined }, { preserveState: true, replace: true })}
                                options={Object.entries(reasons).map(([value, label]) => ({ value, label: String(label) }))}
                                placeholder="Semua Alasan"
                            />
                            <input
                                type="date"
                                value={filters.date_from ?? ''}
                                onChange={(e) => router.get('/owner/exchanges', { ...filters, date_from: e.target.value || undefined }, { preserveState: true, replace: true })}
                                className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
                            />
                            <input
                                type="date"
                                value={filters.date_to ?? ''}
                                onChange={(e) => router.get('/owner/exchanges', { ...filters, date_to: e.target.value || undefined }, { preserveState: true, replace: true })}
                                className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {['all', 'submitted', 'approved', 'preparing', 'shipped', 'received', 'completed', 'rejected'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => router.get('/owner/exchanges', { ...filters, status: status === 'all' ? undefined : status }, { preserveState: true, replace: true })}
                                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                                        (status === 'all' && !filters.status) || filters.status === status
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-surface-muted text-text-muted hover:bg-zinc-200'
                                    }`}
                                >
                                    {status === 'all' ? 'Semua' : getExchangeStatus(status).label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-2.5">
                        {exchanges.data.length === 0 && (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
                                <ArrowLeftRight className="mb-3 h-10 w-10 text-text-subtle" />
                                <div className="text-sm font-medium text-text-muted">Tidak ada permintaan tukar produk</div>
                                <div className="mt-1 text-xs text-text-subtle">Tukar produk akan muncul di sini saat outlet mengajukan</div>
                            </div>
                        )}
                        {exchanges.data.map((ex: any) => {
                            const status = getExchangeStatus(ex.status);
                            const borderClass = STATUS_BORDER[ex.status] ?? 'border-l-gray-300';

                            return (
                                <Link
                                    key={ex.id}
                                    href={`/owner/exchanges/${ex.id}`}
                                    className={`block rounded-xl border border-l-4 border-border bg-white p-4 transition-all hover:shadow-md ${borderClass}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-text">Exchange #{ex.id}</div>
                                            <div className="mt-0.5 text-xs text-text-muted">{ex.outlet?.name}</div>
                                            <div className="mt-1 text-[11px] text-text-subtle">
                                                {ex.return_request_id ? `Return #${ex.return_request_id}` : 'Tanpa return terkait'}
                                            </div>
                                        </div>
                                        <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                                        <span>{ex.items?.length ?? 0} item</span>
                                        <span className="font-semibold text-text">{formatCurrency(ex.exchange_value)}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-[11px] text-text-subtle">
                                        <span>{formatDate(ex.created_at)}</span>
                                        <div className="flex items-center gap-2">
                                            {ex.status === 'submitted' && (
                                                <span
                                                    onClick={(e) => handleApprove(ex.id, e)}
                                                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white active:opacity-90"
                                                >
                                                    Setujui
                                                </span>
                                            )}
                                            <span className="font-semibold text-primary">Tinjau</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    <Pagination links={exchanges.links} />
                </div>

                {/* Right: KPI Sidebar */}
                <div className="hidden lg:block">
                    <div className="sticky top-24 space-y-3">
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <ArrowLeftRight className="h-4 w-4 text-amber-500" />
                                Tukar Produk Tertunda
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{dashboard.pending_exchanges}</div>
                            {dashboard.pending_exchanges > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                                    <ArrowDownRight className="h-3 w-3" />
                                    Perlu ditinjau
                                </div>
                            )}
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Nilai Tukar
                            </div>
                            <div className="mt-2 text-3xl font-bold text-primary">{formatCurrency(dashboard.exchange_value)}</div>
                        </div>
                        {dashboard.total_exchanges !== undefined && (
                            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <Package className="h-4 w-4 text-text-subtle" />
                                    Total Tukar Produk
                                </div>
                                <div className="mt-2 text-3xl font-bold text-text">{dashboard.total_exchanges}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </OwnerPageShell>
    );
}
