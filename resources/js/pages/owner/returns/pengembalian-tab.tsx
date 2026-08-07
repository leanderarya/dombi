import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerTable from '@/components/owner/owner-table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '@/components/ui/table';
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

export default function PengembalianTab({
    returns,
    filters,
    dashboard,
    outlets,
    reasons,
}: any) {
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
        router.post(
            `/owner/returns/${id}/approve`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => toast.success('Disetujui'),
                onError: (errors) =>
                    toast.error(Object.values(errors).flat().join(', ')),
            },
        );
    };

    const currentStatus = filters.status ?? '';

    const navigate = (params: Record<string, string | undefined>) => {
        router.get(
            '/owner/returns',
            { tab: 'pengembalian', ...filters, ...params },
            { preserveState: true, replace: true },
        );
    };

    return (
        <>
            {/* KPI Strip */}
            <div aria-label="Ringkasan Pengembalian">
                <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                        <span className="text-xs font-medium text-text-muted">
                            Return Tertunda
                        </span>
                        <div
                            className={`font-heading text-xl font-bold tabular-nums sm:text-2xl ${dashboard.pending_returns > 0 ? 'text-amber-600' : 'text-text'}`}
                        >
                            {dashboard.pending_returns}
                        </div>
                        {dashboard.pending_returns > 0 && (
                            <p className="text-[11px] text-amber-500">
                                Perlu ditinjau
                            </p>
                        )}
                    </div>
                    <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                        <span className="text-xs font-medium text-text-muted">
                            Nilai Return
                        </span>
                        <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                            {formatCurrency(dashboard.returned_value)}
                        </div>
                    </div>
                    {dashboard.total_returns !== undefined && (
                        <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                            <span className="text-xs font-medium text-text-muted">
                                Total Return
                            </span>
                            <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                                {dashboard.total_returns}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Pills */}
            <div
                className="mb-4 flex flex-wrap items-center gap-2"
                aria-label="Filter Status Pengembalian"
            >
                {RETURN_STATUS_FILTERS.map((f) => {
                    const isActive = currentStatus === f.key;

                    return (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() =>
                                navigate({ status: f.key || undefined })
                            }
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                isActive
                                    ? (statusColorMap[f.key] ??
                                      'bg-primary/10 text-primary ring-primary/20')
                                    : 'bg-surface text-text-muted ring-border hover:bg-mint-wash'
                            }`}
                        >
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
                outletOptions={outlets.map((o: any) => ({
                    value: String(o.id),
                    label: o.name,
                }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) =>
                    navigate({ outlet_id: val || undefined })
                }
                reasonOptions={Object.entries(reasons).map(([v, l]) => ({
                    value: v,
                    label: String(l),
                }))}
                reasonValue={filters.reason ?? ''}
                onReasonChange={(val) => navigate({ reason: val || undefined })}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => navigate({ date: val || undefined })}
            />

            {/* Table */}
            {returns.data.length === 0 ? (
                <EmptyState
                    icon="package"
                    title="Tidak ada permintaan return"
                    description="Belum ada pengajuan return dari outlet"
                />
            ) : (
                <OwnerTable minWidth="600px" aria-label="Tabel Pengembalian">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-surface-muted/50 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                                <TableHead className="px-3 py-2.5 text-left">
                                    Kode
                                </TableHead>
                                <TableHead className="px-3 py-2.5 text-left">
                                    Outlet / Alasan
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
                            {returns.data.map((ret: any) => {
                                const status = getReturnStatus(ret.status);

                                return (
                                    <TableRow
                                        key={ret.id}
                                        className="border-t border-border/20 transition-colors last:border-b-0 hover:bg-mint-wash"
                                    >
                                        <TableCell className="px-3 py-2.5 font-bold text-text tabular-nums">
                                            #{ret.id}
                                        </TableCell>
                                        <TableCell className="truncate px-3 py-2.5 text-text-muted">
                                            {ret.outlet?.name ?? '-'} ·{' '}
                                            {(ret.reason ?? '').replaceAll(
                                                '_',
                                                ' ',
                                            )}
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
                                            {formatCurrency(ret.total_value)}
                                        </TableCell>
                                        <TableCell className="px-3 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {ret.status === 'submitted' && (
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        onClick={(e) =>
                                                            handleApprove(
                                                                ret.id,
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
                                                            `/owner/returns/${ret.id}`,
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

            <Pagination links={returns.links} />
        </>
    );
}
