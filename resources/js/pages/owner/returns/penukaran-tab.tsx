import { router } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
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

export default function PenukaranTab({
    exchanges,
    filters,
    dashboard,
    outlets,
}: any) {
    const [approveId, setApproveId] = useState<number | null>(null);
    const [approveNotes, setApproveNotes] = useState('');
    const [approving, setApproving] = useState(false);

    if (!exchanges || !dashboard) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    const currentStatus = filters.status ?? '';

    const navigate = (params: Record<string, string | undefined>) => {
        router.get(
            '/owner/returns',
            { tab: 'penukaran', ...filters, ...params },
            { preserveState: true, replace: true },
        );
    };

    const handleApprove = () => {
        if (approveId === null) {
            return;
        }

        setApproving(true);
        router.post(
            `/owner/exchanges/${approveId}/approve`,
            { notes: approveNotes },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setApproveId(null);
                    setApproving(false);
                    toast.success('Disetujui');
                },
                onError: (errors) => {
                    setApproving(false);
                    toast.error(Object.values(errors).flat().join(', '));
                },
            },
        );
    };

    return (
        <>
            {/* KPI Strip */}
            <div aria-label="Ringkasan Penukaran">
                <OwnerKpiStrip
                    items={[
                        {
                            label: 'Tertunda',
                            value: dashboard.pending_exchanges,
                            sublabel:
                                dashboard.pending_exchanges > 0
                                    ? 'Perlu ditinjau'
                                    : undefined,
                            sublabelColor: 'text-amber-600',
                        },
                        {
                            label: 'Nilai Tukar',
                            value: formatCurrency(dashboard.exchange_value),
                        },
                        ...(dashboard.total_exchanges !== undefined
                            ? [
                                  {
                                      label: 'Total Tukar',
                                      value: dashboard.total_exchanges,
                                  },
                              ]
                            : []),
                    ]}
                />
            </div>

            {/* Status Pills */}
            <div
                className="mb-4 flex flex-wrap items-center gap-2"
                aria-label="Filter Status Penukaran"
            >
                {EXCHANGE_STATUS_FILTERS.map((f) => {
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
                                    : 'hover:bg-mint-wash bg-surface text-text-muted ring-border'
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
                dateValue={filters.date ?? ''}
                onDateChange={(val) => navigate({ date: val || undefined })}
            />

            {/* Cards */}
            {exchanges.data.length === 0 ? (
                <EmptyState
                    icon="package"
                    title="Tidak ada permintaan tukar produk"
                    description="Belum ada pengajuan penukaran dari outlet"
                />
            ) : (
                <div className="space-y-3">
                    {exchanges.data.map((ex: any) => {
                        const status = getExchangeStatus(ex.status);

                        return (
                            <div
                                key={ex.id}
                                className="rounded-xl border border-border bg-white p-4"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.visit(
                                                    `/owner/exchanges/${ex.id}`,
                                                )
                                            }
                                            className="text-sm font-bold text-text hover:text-primary"
                                        >
                                            Tukar #{ex.id}
                                        </button>
                                        <div className="mt-0.5 text-xs text-text-muted">
                                            {ex.outlet?.name ?? '-'}
                                            {ex.return_request_id && (
                                                <>
                                                    {' '}
                                                    · Return #
                                                    {ex.return_request_id}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <StatusBadge
                                        variant={status.variant}
                                        size="sm"
                                    >
                                        {status.label}
                                    </StatusBadge>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs text-text-subtle">
                                        {ex.items?.length ?? 0} item
                                    </span>
                                    <span className="text-sm font-bold text-primary tabular-nums">
                                        {formatCurrency(ex.exchange_value)}
                                    </span>
                                </div>
                                {ex.status === 'submitted' ? (
                                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setApproveId(ex.id);
                                                setApproveNotes('');
                                            }}
                                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white active:bg-primary/90"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Setujui
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.visit(
                                                    `/owner/exchanges/${ex.id}`,
                                                )
                                            }
                                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-muted active:bg-surface-muted"
                                        >
                                            Tinjau
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-3 border-t border-border pt-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.visit(
                                                    `/owner/exchanges/${ex.id}`,
                                                )
                                            }
                                            className="w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-muted active:bg-surface-muted"
                                        >
                                            Lihat Detail
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Approve Dialog */}
            <Dialog
                open={approveId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setApproveId(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Setujui Tukar Produk</DialogTitle>
                        <DialogDescription>
                            Berikan catatan untuk persetujuan ini (opsional).
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={approveNotes}
                        onChange={(e) => setApproveNotes(e.target.value)}
                        placeholder="Catatan (opsional)"
                        rows={3}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setApproveId(null)}
                        >
                            Batal
                        </Button>
                        <Button onClick={handleApprove} disabled={approving}>
                            {approving ? 'Memproses...' : 'Setujui'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Pagination links={exchanges.links} />
        </>
    );
}
