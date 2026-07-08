import { router } from '@inertiajs/react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import Pagination from '@/components/ui/pagination';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { getExchangeStatus } from '@/lib/status-labels';

const EXCHANGE_STATUS_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'submitted', label: 'Diajukan' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'received', label: 'Diterima' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

const statusColorMap: Record<string, string> = {
    submitted: 'text-amber-600 bg-amber-50 ring-amber-200',
    approved: 'text-blue-600 bg-blue-50 ring-blue-200',
    preparing: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
    shipped: 'text-purple-600 bg-purple-50 ring-purple-200',
    received: 'text-cyan-600 bg-cyan-50 ring-cyan-200',
    received_at_center: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
    completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
    rejected: 'text-red-600 bg-red-50 ring-red-200',
};

export default function PenukaranTab({ exchanges, filters, dashboard, outlets }: any) {
    if (!exchanges || !dashboard) {
        return <div className="h-20 animate-pulse rounded-lg border border-border bg-white" />;
    }

    const handleApprove = (id: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.post(`/owner/exchanges/${id}/approve`, {}, { preserveScroll: true });
    };

    const navigate = (params: Record<string, string | undefined>) => {
        router.get('/owner/returns', { tab: 'penukaran', ...filters, ...params }, { preserveState: true, replace: true });
    };

    return (
        <>
            {/* Status Pills */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {EXCHANGE_STATUS_FILTERS.filter((f) => f.key !== 'all').map((f) => {
                    const isActive = (filters.status ?? '') === f.key;

                    return (
                        <button key={f.key} type="button" onClick={() => navigate({ status: f.key === 'all' ? undefined : f.key })}
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-all ${
                                isActive ? statusColorMap[f.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}>
                            {f.label}
                        </button>
                    );
                })}
            </div>

            {/* Filter controls */}
            <OwnerFilterCard
                searchPlaceholder="Cari kode..."
                searchValue={filters.search ?? ''}
                onSearch={(val) => navigate({ search: val || undefined })}
                outletOptions={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => navigate({ outlet_id: val || undefined })}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => navigate({ date: val || undefined })}
            />

            {/* KPI Strip */}
            <OwnerKpiStrip
                items={[
                    { label: 'Tertunda', value: dashboard.pending_exchanges, sublabel: dashboard.pending_exchanges > 0 ? 'Perlu ditinjau' : undefined, sublabelColor: 'text-amber-600' },
                    { label: 'Nilai Tukar', value: formatCurrency(dashboard.exchange_value) },
                    ...(dashboard.total_exchanges !== undefined ? [{ label: 'Total Tukar', value: dashboard.total_exchanges }] : []),
                ]}
            />

            {/* Table */}
            {exchanges.data.length === 0 ? (
                <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
                    Tidak ada permintaan tukar produk
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[90px_1fr_120px_100px_90px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                        <span>Kode</span><span>Outlet / Info</span><span>Status</span><span className="text-right">Nilai</span><span />
                    </div>
                    {exchanges.data.map((ex: any) => {
                        const status = getExchangeStatus(ex.status);

                        return (
                            <div key={ex.id}
                                className="grid grid-cols-[90px_1fr_120px_100px_90px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-sm transition-colors last:border-t-0 hover:bg-surface-muted">
                                <span className="font-bold tabular-nums text-text">#{ex.id}</span>
                                <span className="truncate text-text-muted">{ex.outlet?.name ?? '-'} · {ex.return_request_id ? `Return #${ex.return_request_id}` : 'Tanpa return'}</span>
                                <span><StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge></span>
                                <span className="text-right font-semibold tabular-nums text-primary">{formatCurrency(ex.exchange_value)}</span>
                                <div className="flex items-center gap-1 justify-end">
                                    {ex.status === 'submitted' && (
                                        <button type="button" onClick={(e) => handleApprove(ex.id, e)}
                                            className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-white hover:bg-primary-hover">
                                            Setujui
                                        </button>
                                    )}
                                    <button type="button" onClick={() => router.visit(`/owner/exchanges/${ex.id}`)}
                                        className="rounded-md px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary-light">
                                        Tinjau
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Pagination links={exchanges.links} />
        </>
    );
}
