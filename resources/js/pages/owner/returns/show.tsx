import { useForm, router } from '@inertiajs/react';
import { CheckCircle2, Clock, Package, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { displayProductName } from '@/lib/display';
import { formatCurrency, formatDate } from '@/lib/format';
import { getReturnStatus } from '@/lib/status-labels';

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
    submitted: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
    received_at_center: Package,
    completed: CheckCircle2,
};

export default function OwnerReturnsShow({ return: ret }: any) {
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);

    const approveForm = useForm({ notes: '' });
    const rejectForm = useForm({ reason: '' });

    if (!ret) {
        return (
            <OwnerPageShell
                title="Memuat..."
                subtitle="Detail return"
                backHref="/owner/returns"
            >
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        <div className="space-y-3 rounded-lg border border-border p-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-3 rounded-lg border border-border p-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                </div>
            </OwnerPageShell>
        );
    }

    const status = getReturnStatus(ret.status);
    const StatusIcon = STATUS_ICONS[ret.status] ?? Clock;

    const handleApprove = () => {
        approveForm.post(`/owner/returns/${ret.id}/approve`, {
            onSuccess: () => {
                setShowApprove(false);
                approveForm.reset();
                toast.success('Disetujui');
            },
            onError: (errors) =>
                toast.error(Object.values(errors).flat().join(', ')),
        });
    };

    const handleReject = () => {
        rejectForm.post(`/owner/returns/${ret.id}/reject`, {
            onSuccess: () => {
                setShowReject(false);
                rejectForm.reset();
                toast.success('Ditolak');
            },
            onError: (errors) =>
                toast.error(Object.values(errors).flat().join(', ')),
        });
    };

    const handleMarkReceived = () => {
        router.post(
            `/owner/returns/${ret.id}/mark-received`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => toast.success('Diterima'),
                onError: (errors) =>
                    toast.error(Object.values(errors).flat().join(', ')),
            },
        );
    };

    return (
        <OwnerPageShell
            title={`Return #${ret.id}`}
            subtitle={ret.outlet?.name}
            backHref="/owner/returns"
        >
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Main Content - 2 columns */}
                <div className="space-y-4 lg:col-span-2">
                    {/* Info */}
                    <div
                        className="rounded-lg border border-border p-4"
                        aria-label="Informasi Return"
                    >
                        <OwnerDetailRow
                            label="Alasan"
                            value={ret.reason_label ?? ret.reason}
                        />
                        <OwnerDetailRow
                            label="Diajukan"
                            value={formatDate(ret.created_at)}
                        />
                        {ret.notes && (
                            <OwnerDetailRow label="Catatan" value={ret.notes} />
                        )}
                        <OwnerDetailRow
                            label="Total Nilai"
                            value={formatCurrency(ret.total_value)}
                            bold
                        />
                    </div>

                    {/* Items */}
                    <div
                        className="rounded-lg border border-border p-4"
                        aria-label="Item Return"
                    >
                        <div className="mb-3 text-xs font-semibold text-text-subtle">
                            Item Return
                        </div>
                        {ret.items?.map((item: any) => (
                            <OwnerDetailRow
                                key={item.id}
                                label={`${displayProductName(item.variant)} x${item.quantity}`}
                                value={formatCurrency(item.subtotal)}
                                bold
                            />
                        ))}
                    </div>
                </div>

                {/* Sidebar - 1 column */}
                <div className="space-y-4">
                    {/* Status + Actions */}
                    <div
                        className="rounded-lg border border-border p-4"
                        aria-label="Status Return"
                    >
                        <div className="mb-3 text-xs font-semibold text-text-subtle">
                            Status
                        </div>
                        <div className="mb-3 flex items-center gap-2">
                            <StatusIcon
                                className="h-4 w-4 text-text-muted"
                                aria-hidden="true"
                            />
                            <StatusBadge variant={status.variant} size="sm">
                                {status.label}
                            </StatusBadge>
                        </div>
                        <OwnerDetailRow
                            label="Total"
                            value={formatCurrency(ret.total_value)}
                            bold
                        />
                        <OwnerDetailRow
                            label="Item"
                            value={`${ret.items?.length ?? 0} item`}
                        />

                        {/* Actions */}
                        {ret.status === 'submitted' && (
                            <div className="mt-4 flex gap-2">
                                <Button
                                    size="sm"
                                    className="min-h-11 flex-1"
                                    aria-label="Setujui Return"
                                    onClick={() => setShowApprove(true)}
                                >
                                    <CheckCircle2
                                        className="mr-1 h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                    Setujui
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="min-h-11 flex-1"
                                    aria-label="Tolak Return"
                                    onClick={() => setShowReject(true)}
                                >
                                    <XCircle
                                        className="mr-1 h-3.5 w-3.5"
                                        aria-hidden="true"
                                    />
                                    Tolak
                                </Button>
                            </div>
                        )}

                        {ret.status === 'approved' && (
                            <Button
                                size="sm"
                                className="mt-4 min-h-11 w-full"
                                onClick={handleMarkReceived}
                            >
                                <Package
                                    className="mr-1 h-3.5 w-3.5"
                                    aria-hidden="true"
                                />
                                Barang Diterima di Pusat
                            </Button>
                        )}

                        {ret.status === 'received_at_center' && (
                            <>
                                <div className="mt-4 mb-3 text-xs font-semibold text-text-subtle">
                                    Status Item
                                </div>
                                {ret.items?.map((item: any) => {
                                    const isDecided = item.disposition !== null;
                                    const isStored =
                                        item.disposition === 'stored';

                                    return (
                                        <div
                                            key={item.id}
                                            className="mb-2 flex items-center justify-between rounded-lg border border-border p-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-medium tabular-nums text-text">
                                                    {displayProductName(
                                                        item.variant,
                                                    )}{' '}
                                                    x{item.quantity}
                                                </div>
                                                <div className="text-xs tabular-nums text-text-muted">
                                                    {formatCurrency(
                                                        item.subtotal,
                                                    )}
                                                </div>
                                            </div>
                                            <div className="ml-3 shrink-0">
                                                {isDecided ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                isStored
                                                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                                                    : 'bg-red-50 text-red-700 ring-1 ring-red-200'
                                                            }`}
                                                        >
                                                            {isStored
                                                                ? '✓ Disimpan'
                                                                : '✗ Dibuang'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                router.post(
                                                                    `/owner/returns/${ret.id}/items/${item.id}/${isStored ? 'dispose' : 'store'}`,
                                                                    {},
                                                                    {
                                                                        preserveScroll: true,
                                                                        onSuccess:
                                                                            () =>
                                                                                toast.success(
                                                                                    isStored
                                                                                        ? 'Diubah menjadi dibuang'
                                                                                        : 'Diubah menjadi disimpan',
                                                                                ),
                                                                        onError:
                                                                            (
                                                                                errors,
                                                                            ) =>
                                                                                toast.error(
                                                                                    Object.values(
                                                                                        errors,
                                                                                    )
                                                                                        .flat()
                                                                                        .join(
                                                                                            ', ',
                                                                                        ),
                                                                                ),
                                                                    },
                                                                );
                                                            }}
                                                            className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-surface-muted"
                                                        >
                                                            Ubah
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                router.post(
                                                                    `/owner/returns/${ret.id}/items/${item.id}/store`,
                                                                    {},
                                                                    {
                                                                        preserveScroll: true,
                                                                        onSuccess:
                                                                            () =>
                                                                                toast.success(
                                                                                    'Item disimpan',
                                                                                ),
                                                                        onError:
                                                                            (
                                                                                errors,
                                                                            ) =>
                                                                                toast.error(
                                                                                    Object.values(
                                                                                        errors,
                                                                                    )
                                                                                        .flat()
                                                                                        .join(
                                                                                            ', ',
                                                                                        ),
                                                                                ),
                                                                    },
                                                                );
                                                            }}
                                                            className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100"
                                                        >
                                                            Simpan
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                router.post(
                                                                    `/owner/returns/${ret.id}/items/${item.id}/dispose`,
                                                                    {},
                                                                    {
                                                                        preserveScroll: true,
                                                                        onSuccess:
                                                                            () =>
                                                                                toast.success(
                                                                                    'Item dibuang',
                                                                                ),
                                                                        onError:
                                                                            (
                                                                                errors,
                                                                            ) =>
                                                                                toast.error(
                                                                                    Object.values(
                                                                                        errors,
                                                                                    )
                                                                                        .flat()
                                                                                        .join(
                                                                                            ', ',
                                                                                        ),
                                                                                ),
                                                                    },
                                                                );
                                                            }}
                                                            className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 transition-colors hover:bg-red-100"
                                                        >
                                                            Buang
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Progress + Complete */}
                                {(() => {
                                    const total = ret.items?.length ?? 0;
                                    const decided =
                                        ret.items?.filter(
                                            (i: any) => i.disposition !== null,
                                        ).length ?? 0;
                                    const allDecided = decided === total;

                                    return (
                                        <div className="mt-3 space-y-3">
                                            <div className="text-xs tabular-nums text-text-muted">
                                                {allDecided
                                                    ? 'Semua item sudah ditentukan'
                                                    : `${decided}/${total} item ditentukan`}
                                            </div>
                                            <Button
                                                size="sm"
                                                className={`min-h-11 w-full ${
                                                    allDecided
                                                        ? 'bg-primary hover:bg-primary-hover'
                                                        : 'cursor-not-allowed bg-border text-text-muted'
                                                }`}
                                                disabled={!allDecided}
                                                onClick={() => {
                                                    router.post(
                                                        `/owner/returns/${ret.id}/complete`,
                                                        {},
                                                        {
                                                            preserveScroll: true,
                                                            onSuccess: () =>
                                                                toast.success(
                                                                    'Return selesai',
                                                                ),
                                                            onError: (errors) =>
                                                                toast.error(
                                                                    Object.values(
                                                                        errors,
                                                                    )
                                                                        .flat()
                                                                        .join(
                                                                            ', ',
                                                                        ),
                                                                ),
                                                        },
                                                    );
                                                }}
                                            >
                                                <CheckCircle2
                                                    className="mr-1 h-3.5 w-3.5"
                                                    aria-hidden="true"
                                                />
                                                {allDecided
                                                    ? 'Selesai & Sesuaikan Settlement'
                                                    : `Selesaikan (${decided}/${total})`}
                                            </Button>
                                        </div>
                                    );
                                })()}
                            </>
                        )}

                        {ret.status === 'completed' && (
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                                <CheckCircle2
                                    className="mx-auto h-5 w-5 text-emerald-500"
                                    aria-hidden="true"
                                />
                                <div className="mt-1 text-xs font-semibold text-emerald-800">
                                    Return Selesai
                                </div>
                            </div>
                        )}

                        {ret.status === 'rejected' && (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                                <XCircle
                                    className="mx-auto h-5 w-5 text-red-500"
                                    aria-hidden="true"
                                />
                                <div className="mt-1 text-xs font-semibold text-red-800">
                                    Return Ditolak
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status History / Timeline */}
                    {ret.status_histories?.length > 0 && (
                        <div
                            className="rounded-lg border border-border p-4"
                            aria-label="Riwayat Status Return"
                        >
                            <div className="mb-3 text-xs font-semibold text-text-subtle">
                                Riwayat Status
                            </div>
                            <div className="space-y-3">
                                {ret.status_histories.map(
                                    (h: any, i: number) => {
                                        const isLast =
                                            i ===
                                            ret.status_histories.length - 1;
                                        const histStatus = getReturnStatus(
                                            h.to_status,
                                        );

                                        return (
                                            <div
                                                key={i}
                                                className="flex items-start gap-2.5"
                                            >
                                                <div className="flex flex-col items-center">
                                                    <div
                                                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${isLast ? 'bg-primary' : 'bg-border'}`}
                                                    />
                                                    {i <
                                                        ret.status_histories
                                                            .length -
                                                            1 && (
                                                        <div className="mt-1 h-4 w-px bg-border" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <StatusBadge
                                                            variant={
                                                                histStatus.variant
                                                            }
                                                            size="sm"
                                                        >
                                                            {histStatus.label}
                                                        </StatusBadge>
                                                    </div>
                                                    <div className="mt-0.5 text-xs tabular-nums text-text-muted">
                                                        {h.actor?.name} &middot;{' '}
                                                        {formatDate(
                                                            h.created_at,
                                                        )}
                                                    </div>
                                                    {h.notes && (
                                                        <div className="mt-0.5 text-xs text-text-muted">
                                                            {h.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Approve Dialog */}
            <Dialog open={showApprove} onOpenChange={setShowApprove}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Setujui Return</DialogTitle>
                        <DialogDescription>
                            Berikan catatan untuk persetujuan ini (opsional).
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={approveForm.data.notes}
                        onChange={(e) =>
                            approveForm.setData('notes', e.target.value)
                        }
                        placeholder="Catatan (opsional)"
                        rows={3}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowApprove(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleApprove}
                            disabled={approveForm.processing}
                        >
                            {approveForm.processing
                                ? 'Memproses...'
                                : 'Setujui'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={showReject} onOpenChange={setShowReject}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tolak Return</DialogTitle>
                        <DialogDescription>
                            Berikan alasan penolakan return ini.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={rejectForm.data.reason}
                        onChange={(e) =>
                            rejectForm.setData('reason', e.target.value)
                        }
                        placeholder="Alasan penolakan"
                        rows={3}
                    />
                    {rejectForm.errors.reason && (
                        <div className="text-xs text-red-500">
                            {rejectForm.errors.reason}
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowReject(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={rejectForm.processing}
                        >
                            {rejectForm.processing ? 'Memproses...' : 'Tolak'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
