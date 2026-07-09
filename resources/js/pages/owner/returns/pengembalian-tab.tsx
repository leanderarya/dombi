import { router } from '@inertiajs/react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { getReturnStatus } from '@/lib/status-labels';

const RETURN_STATUS_FILTERS = [
    { key: '', label: 'Semua' },
    { key: 'submitted', label: 'Diajukan' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'received_at_center', label: 'Diterima' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

const statusColorMap: Record<string, string> = {
    '': 'text-text bg-surface-muted ring-border',
    submitted: 'text-amber-600 bg-amber-50 ring-amber-200',
    approved: 'text-blue-600 bg-blue-50 ring-blue-200',
    received_at_center: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
    completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
    rejected: 'text-red-600 bg-red-50 ring-red-200',
};

export default function PengembalianTab({ returns, filters, dashboard, outlets, reasons }: any) {
    if (!returns || !dashboard) {
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
        router.post(`/owner/returns/${id}/approve`, {}, { preserveScroll: true });
    };

    const currentStatus = filters.status ?? '';

    const navigate = (params: Record<string, string | undefined>) => {
        router.get('/owner/returns', { tab: 'pengembalian', ...filters, ...params }, { preserveState: true, replace: true });
    };

    return (
        <>
            {/* KPI Strip */}
            <OwnerKpiStrip
                items={[
                    { label: 'Return Tertunda', value: dashboard.pending_returns, sublabel: dashboard.pending_returns > 0 ? 'Perlu ditinjau' : undefined, sublabelColor: 'text-amber-600' },
                    { label: 'Nilai Return', value: formatCurrency(dashboard.returned_value) },
                    ...(dashboard.total_returns !== undefined ? [{ label: 'Total Return', value: dashboard.total_returns }] : []),
                ]}
            />

            {/* Status Pills */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {RETURN_STATUS_FILTERS.map((f) => {
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
                reasonOptions={Object.entries(reasons).map(([v, l]) => ({ value: v, label: String(l) }))}
                reasonValue={filters.reason ?? ''}
                onReasonChange={(val) => navigate({ reason: val || undefined })}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => navigate({ date: val || undefined })}
            />

            {/* Table */}
            {returns.data.length === 0 ? (
                <EmptyState icon="package" title="Tidak ada permintaan return" description="Belum ada pengajuan return dari outlet" />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[600px] text-sm">
                        <thead>
                            <tr className="bg-[#fafafa] text-xs font-semibold uppercase tracking-wide text-text-muted">
                                <th className="px-3 py-2.5 text-left">Kode</th>
                                <th className="px-3 py-2.5 text-left">Outlet / Alasan</th>
                                <th className="px-3 py-2.5 text-left">Status</th>
                                <th className="px-3 py-2.5 text-right">Nilai</th>
                                <th className="px-3 py-2.5 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {returns.data.map((ret: any) => {
                                const status = getReturnStatus(ret.status);

                                return (
                                    <tr key={ret.id} className="border-t border-[#f0f0f0] transition-colors last:border-b-0 hover:bg-surface-muted">
                                        <td className="px-3 py-2.5 font-bold tabular-nums text-text">#{ret.id}</td>
                                        <td className="px-3 py-2.5 truncate text-text-muted">{ret.outlet?.name ?? '-'} · {(ret.reason ?? '').replaceAll('_', ' ')}</td>
                                        <td className="px-3 py-2.5"><StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge></td>
                                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-primary">{formatCurrency(ret.total_value)}</td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex items-center gap-1 justify-end">
                                                {ret.status === 'submitted' && (
                                                    <Button size="sm" variant="default" onClick={(e) => handleApprove(ret.id, e)}>
                                                        Setujui
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="ghost" onClick={() => router.visit(`/owner/returns/${ret.id}`)}>
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

            <Pagination links={returns.links} />
        </>
    );
}
