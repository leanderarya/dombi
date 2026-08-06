import { router } from '@inertiajs/react';
import { Package } from 'lucide-react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerTable from '@/components/owner/owner-table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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

export default function OwnerExchangesIndex({
    exchanges,
    filters,
    dashboard,
    outlets,
    reasons,
}: any) {
    if (!exchanges || !filters) {
        return (
            <OwnerPageShell
                title="Permintaan Tukar Produk"
                subtitle="Kelola penukaran barang dari outlet"
            >
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const handleApprove = (id: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.post(
            `/owner/exchanges/${id}/approve`,
            {},
            { preserveScroll: true },
        );
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
        <OwnerPageShell
            title="Permintaan Tukar Produk"
            subtitle="Kelola penukaran barang dari outlet"
        >
            {/* KPI Strip */}
            <div aria-label="Ringkasan Tukar Produk">
                <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                        <span className="text-xs font-medium text-text-muted">Tertunda</span>
                        <div className={`font-heading text-xl font-bold tabular-nums sm:text-2xl ${dashboard.pending_exchanges > 0 ? 'text-amber-600' : 'text-text'}`}>{dashboard.pending_exchanges}</div>
                        {dashboard.pending_exchanges > 0 && <p className="text-[11px] text-amber-500">Perlu ditinjau</p>}
                    </div>
                    <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                        <span className="text-xs font-medium text-text-muted">Nilai Tukar</span>
                        <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">{formatCurrency(dashboard.exchange_value)}</div>
                    </div>
                    {dashboard.total_exchanges !== undefined && (
                        <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                            <span className="text-xs font-medium text-text-muted">Total</span>
                            <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">{dashboard.total_exchanges}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Pills */}
            <div
                className="mb-4 flex flex-wrap items-center gap-2"
                aria-label="Filter Status Tukar Produk"
            >
                {statusFilters.map((sf) => {
                    const isActive = currentStatus === sf.key;

                    return (
                        <button
                            key={sf.key}
                            type="button"
                            onClick={() => setFilter('status', sf.key)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                isActive
                                    ? (colorMap[sf.key] ??
                                      'bg-primary/10 text-primary ring-primary/20')
                                    : 'bg-surface text-text-muted ring-border hover:bg-mint-wash'
                            }`}
                        >
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
                outletOptions={outlets.map((o: any) => ({
                    value: String(o.id),
                    label: o.name,
                }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => setFilter('outlet_id', val)}
                reasonOptions={
                    reasons
                        ? Object.entries(reasons).map(([v, l]) => ({
                              value: v,
                              label: String(l),
                          }))
                        : undefined
                }
                reasonValue={filters.reason ?? ''}
                onReasonChange={(val) => setFilter('reason', val)}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => setFilter('date', val)}
            />

            {/* Table */}
            {exchanges.data.length === 0 ? (
                <EmptyState
                    icon={<Package className="h-8 w-8 text-text-subtle" />}
                    title="Tidak ada permintaan tukar produk"
                    description="Belum ada pengajuan penukaran dari outlet"
                />
            ) : (
                <OwnerTable minWidth="600px">
                    <Table className="text-sm" aria-label="Tabel Tukar Produk">
                        <TableHeader>
                            <TableRow className="bg-surface-muted/50 text-xs font-medium text-text-muted">
                                <TableHead className="px-3 py-2.5 text-left">
                                    Kode
                                </TableHead>
                                <TableHead className="px-3 py-2.5 text-left">
                                    Outlet / Info
                                </TableHead>
                                <TableHead className="px-3 py-2.5 text-left">
                                    Status
                                </TableHead>
                                <TableHead className="px-3 py-2.5 text-right">
                                    Nilai
                                </TableHead>
                                <TableHead className="px-3 py-2.5 text-right">
                                    Aksi
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {exchanges.data.map((ex: any) => {
                                const status = getExchangeStatus(ex.status);

                                return (
                                    <TableRow
                                        key={ex.id}
                                        className="border-t border-border/20 transition-colors last:border-b-0 hover:bg-mint-wash"
                                    >
                                        <TableCell className="px-3 py-2.5 font-bold text-text tabular-nums">
                                            #{ex.id}
                                        </TableCell>
                                        <TableCell className="truncate px-3 py-2.5 text-text-muted">
                                            {ex.outlet?.name ?? '-'} ·{' '}
                                            {ex.return_request_id
                                                ? `Return #${ex.return_request_id}`
                                                : 'Tanpa return'}
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5">
                                            <StatusBadge
                                                variant={status.variant}
                                                size="sm"
                                            >
                                                {status.label}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5 text-right font-semibold text-primary tabular-nums">
                                            {formatCurrency(ex.exchange_value)}
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {ex.status === 'submitted' && (
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        onClick={(e) =>
                                                            handleApprove(
                                                                ex.id,
                                                                e,
                                                            )
                                                        }
                                                    >
                                                        Setujui
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        router.visit(
                                                            `/owner/exchanges/${ex.id}`,
                                                        )
                                                    }
                                                >
                                                    Tinjau
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </OwnerTable>
            )}

            <Pagination links={exchanges.links} />
        </OwnerPageShell>
    );
}
