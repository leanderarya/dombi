import { router } from '@inertiajs/react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { getExchangeStatus } from '@/lib/status-labels';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'submitted', label: 'Diajukan' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'received', label: 'Diterima' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

const colorMap: Record<string, string> = {
    '': 'text-text bg-surface-muted ring-border',
    submitted: 'text-amber-600 bg-amber-50 ring-amber-200',
    approved: 'text-blue-600 bg-blue-50 ring-blue-200',
    preparing: 'text-indigo-600 bg-indigo-50 ring-indigo-200',
    shipped: 'text-purple-600 bg-purple-50 ring-purple-200',
    received: 'text-cyan-600 bg-cyan-50 ring-cyan-200',
    completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
    rejected: 'text-red-600 bg-red-50 ring-red-200',
};

export default function OwnerExchangesIndex({ exchanges, filters, dashboard, outlets, reasons }: any) {
    if (!exchanges || !filters) {
        return (
            <OwnerPageShell title="Permintaan Tukar Produk" subtitle="Kelola penukaran barang dari outlet">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const handleApprove = (id: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.post(`/owner/exchanges/${id}/approve`, {}, { preserveScroll: true });
    };

    const currentStatus = filters.status ?? '';

    const setFilter = (key: string, value: string) => {
        router.get(
            '/owner/exchanges',
            { ...filters, [key]: value || undefined },
            { preserveState: true, replace: true },
        );
    };

    return (
        <OwnerPageShell title="Permintaan Tukar Produk" subtitle="Kelola penukaran barang dari outlet">
            {/* KPI Strip */}
            <OwnerKpiStrip
                items={[
                    { label: 'Tertunda', value: dashboard.pending_exchanges, sublabel: dashboard.pending_exchanges > 0 ? 'Perlu ditinjau' : undefined, sublabelColor: 'text-amber-600' },
                    { label: 'Nilai Tukar', value: formatCurrency(dashboard.exchange_value) },
                    ...(dashboard.total_exchanges !== undefined ? [{ label: 'Total', value: dashboard.total_exchanges }] : []),
                ]}
            />

            {/* Status Pills */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {statusFilters.map((sf) => {
                    const isActive = currentStatus === sf.key;

                    return (
                        <button key={sf.key} type="button" onClick={() => setFilter('status', sf.key)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                isActive ? colorMap[sf.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                            }`}>
                            {sf.label}
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
                onSearch={(val) => setFilter('search', val)}
                outletOptions={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => setFilter('outlet_id', val)}
                reasonOptions={reasons ? Object.entries(reasons).map(([v, l]) => ({ value: v, label: String(l) })) : undefined}
                reasonValue={filters.reason ?? ''}
                onReasonChange={(val) => setFilter('reason', val)}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => setFilter('date', val)}
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
        </OwnerPageShell>
    );
}
