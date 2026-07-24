import { Link, router } from '@inertiajs/react';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle, XCircle, Play, Ban, ArrowLeft, ArrowRight, Undo2, Copy, Check } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useState } from 'react';
import RefundCompletionModal from '@/components/owner/finance/refund-completion-modal';
import RefundRejectionModal from '@/components/owner/finance/refund-rejection-modal';
import { GuestRefundDestinationDialog, RefundRollbackDialog } from '@/components/owner/finance/refund-operations-dialogs';
import type { OwnerRefundPayload, RefundPagination, RefundQueue, RefundQueueCounts } from '@/types/refund';

const QUEUE_LABELS: Record<RefundQueue, string> = {
    awaiting_customer: 'Menunggu Data Customer',
    awaiting_guest: 'Menunggu Data Guest',
    ready: 'Siap Diproses',
    in_progress: 'Sedang Diproses',
    action_required: 'Perlu Tindakan',
    completed: 'Selesai',
    rejected: 'Ditolak',
};

const QUEUE_ORDER: RefundQueue[] = [
    'awaiting_customer', 'awaiting_guest', 'ready', 'in_progress', 'action_required', 'completed', 'rejected',
];

interface Props {
    refunds: RefundPagination;
    refundCounts: RefundQueueCounts;
    refundFilter: RefundQueue;
}

export default function RefundTab({ refunds, refundCounts, refundFilter }: Props) {
    const [startConfirm, setStartConfirm] = useState<number | null>(null);
    const [completionOrder, setCompletionOrder] = useState<OwnerRefundPayload | null>(null);
    const [rejectionOrder, setRejectionOrder] = useState<OwnerRefundPayload | null>(null);
    const [destinationOrder, setDestinationOrder] = useState<OwnerRefundPayload | null>(null);
    const [rollbackOrder, setRollbackOrder] = useState<OwnerRefundPayload | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    const handleStart = (orderId: number) => {
        router.post(`/owner/refunds/${orderId}/start`, {}, {
            onSuccess: () => { toast.success('Proses refund dimulai'); setStartConfirm(null); },
            onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
        });
    };

    const copyToClipboard = async (text: string, id: number, label: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <>
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {QUEUE_ORDER.map((queue) => (
                        <Link
                            key={queue}
                            href={`/owner/finance?tab=refund&filter=${queue}`}
                            preserveState
                            preserveScroll
                            aria-current={refundFilter === queue ? 'page' : undefined}
                            className={`min-h-11 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                refundFilter === queue
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-text-muted hover:bg-muted'
                            }`}
                        >
                            {QUEUE_LABELS[queue]}
                            {refundCounts[queue] > 0 && (
                                <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px]">
                                    {refundCounts[queue]}
                                </span>
                            )}
                        </Link>
                    ))}
                </div>

                {refunds.data.length === 0 ? (
                    <div className="rounded-xl border border-border bg-surface p-8 text-center">
                        <CheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
                        <p className="mt-2 text-sm text-text-muted">
                            Tidak ada refund di antrean ini
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {refunds.data.map((refund) => {
                            const {
                                order_id, order_code, order_url, amount, destination,
                                proof_url, transfer_reference, transfer_note,
                                rejection, customer_kind, customer_name,
                                can_enter_destination, can_legacy_repair,
                                can_start, can_reject, can_rollback, can_complete,
                                queue_state, requested_at, submitted_at, started_at,
                                completed_at, timeline, status_label,
                            } = refund;

                            return (
                                <div key={order_id} className="rounded-xl border border-border bg-surface p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <Link href={order_url} className="text-sm font-semibold text-text hover:underline">
                                                    {order_code}
                                                </Link>
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                                                    {status_label}
                                                </span>
                                                <span className="text-[10px] text-text-subtle">
                                                    {customer_kind === 'guest' ? 'Guest' : customer_name}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-sm font-bold tabular-nums">
                                                {formatCurrency(amount)}
                                            </div>

                                            {/* Destination */}
                                            {destination && (
                                                <div className="mt-2 rounded-lg bg-muted p-2 text-xs">
                                                    <p className="break-all">{destination.label} — {destination.holder}</p>
                                                    <p className="font-mono break-all">{destination.number}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(destination.number, order_id, 'Nomor')}
                                                        className="mt-1 inline-flex items-center gap-1 text-primary underline"
                                                        aria-label={copiedId === order_id ? 'Nomor berhasil disalin' : 'Salin nomor rekening'}
                                                    >
                                                        {copiedId === order_id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                                        {copiedId === order_id ? 'Tersalin' : 'Salin'}
                                                    </button>
                                                </div>
                                            )}

                                            {/* Proof link */}
                                            {proof_url && (
                                                <a href={proof_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-primary underline">
                                                    Lihat Bukti Transfer
                                                </a>
                                            )}

                                            {/* Transfer reference */}
                                            {transfer_reference && (
                                                <p className="mt-1 text-xs text-text-muted">Ref: {transfer_reference}</p>
                                            )}
                                            {transfer_note && (
                                                <p className="text-xs text-text-subtle">{transfer_note}</p>
                                            )}

                                            {/* Rejection */}
                                            {rejection && (
                                                <div className="mt-2 text-xs text-red-600">
                                                    {rejection.label}
                                                    {rejection.note && <>: {rejection.note}</>}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex shrink-0 flex-col gap-2">
                                            {can_enter_destination && (
                                                <button
                                                    onClick={() => setDestinationOrder(refund)}
                                                    className="min-h-11 flex items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-text-muted hover:bg-muted"
                                                >
                                                    Isi Tujuan
                                                </button>
                                            )}
                                            {can_start && (
                                                <>
                                                    {startConfirm === order_id ? (
                                                        <div className="flex flex-col gap-1">
                                                            <button onClick={() => handleStart(order_id)} className="min-h-11 flex items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white">
                                                                Konfirmasi Mulai
                                                            </button>
                                                            <button onClick={() => setStartConfirm(null)} className="min-h-11 flex items-center gap-1 rounded-lg border px-3 text-xs text-text-muted">
                                                                Batal
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setStartConfirm(order_id)}
                                                            className="min-h-11 flex items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white"
                                                        >
                                                            <Play className="h-3.5 w-3.5" /> Mulai
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {can_reject && (
                                                <button
                                                    onClick={() => setRejectionOrder(refund)}
                                                    className="min-h-11 flex items-center gap-1.5 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600"
                                                >
                                                    <Ban className="h-3.5 w-3.5" /> Tolak
                                                </button>
                                            )}
                                            {can_rollback && (
                                                <button
                                                    onClick={() => setRollbackOrder(refund)}
                                                    className="min-h-11 flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-600"
                                                >
                                                    <Undo2 className="h-3.5 w-3.5" /> Rollback
                                                </button>
                                            )}
                                            {can_complete && (
                                                <button
                                                    onClick={() => setCompletionOrder(refund)}
                                                    className="min-h-11 flex items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white"
                                                >
                                                    <CheckCircle className="h-3.5 w-3.5" /> Selesai
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {refunds.links && refunds.links.length > 3 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                        {refunds.links.map((link, i) => {
                            if (!link.url) {
                                return <span key={i} className="px-2 py-1 text-xs text-text-subtle">{link.label}</span>;
                            }
                            return (
                                <Link
                                    key={i}
                                    href={link.url}
                                    preserveState
                                    preserveScroll
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                        link.active
                                            ? 'border-primary bg-primary text-white'
                                            : 'border-border text-text-muted hover:bg-muted'
                                    }`}
                                >
                                    {link.label.includes('Previous') || link.label.includes('Sebelumnya') ? (
                                        <ArrowLeft className="h-3.5 w-3.5" />
                                    ) : link.label.includes('Next') || link.label.includes('Berikutnya') ? (
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    ) : (
                                        link.label
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {completionOrder && (
                <RefundCompletionModal
                    orderId={completionOrder.order_id}
                    orderCode={completionOrder.order_code}
                    amount={completionOrder.amount}
                    open={!!completionOrder}
                    onClose={() => setCompletionOrder(null)}
                />
            )}

            {rejectionOrder && (
                <RefundRejectionModal
                    orderId={rejectionOrder.order_id}
                    orderCode={rejectionOrder.order_code}
                    open={!!rejectionOrder}
                    canLegacyRepair={rejectionOrder.can_legacy_repair}
                    onClose={() => setRejectionOrder(null)}
                />
            )}

            <GuestRefundDestinationDialog
                refund={destinationOrder}
                open={!!destinationOrder}
                onClose={() => setDestinationOrder(null)}
            />

            <RefundRollbackDialog
                refund={rollbackOrder}
                open={!!rollbackOrder}
                onClose={() => setRollbackOrder(null)}
            />
        </>
    );
}
