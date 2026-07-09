import { router } from '@inertiajs/react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { getExchangeStatus } from '@/lib/status-labels';

const EXCHANGE_STATUS_FILTERS = [
    { key: '', label: 'Semua' },
    { key: 'submitted', label: 'Diajukan' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'received', label: 'Diterima' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

const statusColorMap: Record<string, string> = {
    '': 'text-text bg-surface-muted ring-border',
    submitted: 'text-amber-600 bg-amber-50 ring-amber-200',
    approved: 'text-blue-600 bg-blue-50 ring-blue-200',
    preparing: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
    shipped: 'text-purple-600 bg-purple-50 ring-purple-200',
    received: 'text-cyan-600 bg-cyan-50 ring-cyan-200',
    completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
    rejected: 'text-red-600 bg-red-50 ring-red-200',
};

export default function PenukaranTab({ exchanges, filters, dashboard, outlets }: any) {
    if (!exchanges || !dashboard) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    const handleApprove = (id: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.post(`/owner/exchanges/${id}/approve`, {}, { preserveScroll: true });
    };

    const currentStatus = filters.status ?? '';

    const navigate = (params: Record<string, string | undefined>) => {
        router.get('/owner/returns', { tab: 'penukaran', ...filters, ...params }, { preserveState: true, replace: true });
    };

    return (
        <>
            {/* KPI Strip */}
            <OwnerKpiStrip
                items={[
                    { label: 'Tertunda', value: dashboard.pending_exchanges, sublabel: dashboard.pending_exchanges > 0 ? 'Perlu ditinjau' : undefined, sublabelColor: 'text-amber-600' },
                    { label: 'Nilai Tukar', value: formatCurrency(dashboard.exchange_value) },
                    ...(dashboard.total_exchanges !== undefined ? [{ label: 'Total Tukar', value: dashboard.total_exchanges }] : []),
                ]}
            />

            {/* Status Pills */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {EXCHANGE_STATUS_FILTERS.map((f) => {
                    const isActive = currentStatus === f.key;

                    return (
                        <button key={f.key} type="button" onClick={() => navigate({ status: f.key || undefined })}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                isActive ? statusColorMap[f.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}>
                            {f.label}
                        </button>
                    );
                })}
            </div>

            {/* Filter controls - Collapsible */}
            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari kode..."
                searchValue={filters.search ?? ''}
                onSearch={(val) => navigate({ search: val || undefined })}
                outletOptions={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => navigate({ outlet_id: val || undefined })}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => navigate({ date: val || undefined })}
            />

            {/* Table */}
            {exchanges.data.length === 0 ? (
                <EmptyState icon="package" title="Tidak ada permintaan tukar produk" description="Belum ada pengajuan penukaran dari outlet" />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[600px] text-sm">
                        <thead>
                            <tr className="bg-[#fafafa] text-xs font-semibold uppercase tracking-wide text-text-muted">
                                <th className="px-3 py-2.5 text-left">Kode</th>
                                <th className="px-3 py-2.5 text-left">Outlet / Info</th>
                                <th className="px-3 py-2.5 text-left">Status</th>
                                <th className="px-3 py-2.5 text-right">Nilai</th>
                                <th className="px-3 py-2.5 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exchanges.data.map((ex: any) => {
                                const status = getExchangeStatus(ex.status);

                                return (
                                    <tr key={ex.id} className="border-t border-[#f0f0f0] transition-colors last:border-b-0 hover:bg-surface-muted">
                                        <td className="px-3 py-2.5 font-bold tabular-nums text-text">#{ex.id}</td>
                                        <td className="px-3 py-2.5 truncate text-text-muted">{ex.outlet?.name ?? '-'} · {ex.return_request_id ? `Return #${ex.return_request_id}` : 'Tanpa return'}</td>
                                        <td className="px-3 py-2.5"><StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge></td>
                                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-primary">{formatCurrency(ex.exchange_value)}</td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex items-center gap-1 justify-end">
                                                {ex.status === 'submitted' && (
                                                    <Button size="sm" variant="default" onClick={(e) => handleApprove(ex.id, e)}>
                                                        Setujui
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="ghost" onClick={() => router.visit(`/owner/exchanges/${ex.id}`)}>
                                                    Tinjau
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination links={exchanges.links} />
        </>
    );
}
