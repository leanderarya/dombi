import { Link, router } from '@inertiajs/react';
import { toast } from 'sonner';
import { useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Ban,
    Banknote,
    Check,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Copy,
    ExternalLink,
    Play,
    RefreshCw,
    Smartphone,
    Undo2,
    User,
    UserCheck,
    XCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import RefundCompletionModal from '@/components/owner/finance/refund-completion-modal';
import RefundRejectionModal from '@/components/owner/finance/refund-rejection-modal';
import { GuestRefundDestinationDialog, RefundRollbackDialog } from '@/components/owner/finance/refund-operations-dialogs';
import type { OwnerRefundPayload, RefundPagination, RefundQueue, RefundQueueCounts, RefundHistoryItem } from '@/types/refund';

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
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const handleStart = (orderId: number) => {
        router.post(`/owner/refunds/${orderId}/start`, {}, {
            onSuccess: () => { toast.success('Proses refund dimulai'); setStartConfirm(null); },
            onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
        });
    };

    const copyToClipboard = async (text: string, id: number) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const activeCount = refundCounts.awaiting_customer + refundCounts.awaiting_guest + refundCounts.ready + refundCounts.in_progress + refundCounts.action_required;

    return (
        <>
            <div className="space-y-4">
                {/* Queue filter tabs */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                        {QUEUE_ORDER.map((queue) => (
                            <Link
                                key={queue}
                                href={`/owner/finance?tab=refund&filter=${queue}`}
                                preserveState
                                preserveScroll
                                aria-current={refundFilter === queue ? 'page' : undefined}
                                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                                    refundFilter === queue
                                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                        : 'border-border text-text-muted hover:border-border-strong hover:text-text'
                                }`}
                            >
                                {QUEUE_LABELS[queue]}
                                {refundCounts[queue] > 0 && (
                                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                                        {refundCounts[queue]}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>
                    {activeCount > 0 && (
                        <span className="hidden text-xs text-text-subtle sm:block">
                            {activeCount} antrean aktif
                        </span>
                    )}
                </div>

                {/* Empty state */}
                {refunds.data.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-10">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                            <CheckCircle className="h-6 w-6 text-emerald-500" />
                        </span>
                        <div className="text-center">
                            <p className="text-sm font-medium text-text">Tidak ada refund</p>
                            <p className="mt-0.5 text-xs text-text-muted">
                                Semua refund di antrean "{QUEUE_LABELS[refundFilter]}" sudah diproses.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {refunds.data.map((refund) => {
                            const {
                                order_id, order_code, order_url, amount, destination,
                                proof_url, transfer_reference, transfer_note,
                                rejection, customer_kind, customer_name, customer_phone,
                                can_enter_destination, can_legacy_repair,
                                can_start, can_reject, can_rollback, can_complete,
                                queue_state, requested_at, submitted_at, started_at,
                                completed_at, timeline, status_label,
                            } = refund;

                            const isExpanded = expandedId === order_id;
                            const isConfirming = startConfirm === order_id;

                            return (
                                <div key={order_id} className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between gap-3 p-4 pb-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={order_url}
                                                    className="truncate text-sm font-bold text-text hover:text-primary"
                                                >
                                                    {order_code}
                                                </Link>
                                                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                                                    {status_label}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                                                {customer_kind === 'guest' ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        <User className="h-3 w-3" /> Guest
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1">
                                                        <UserCheck className="h-3 w-3" /> {customer_name}
                                                    </span>
                                                )}
                                                {customer_phone && <span>· {customer_phone}</span>}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-base font-bold tabular-nums text-text">
                                                {formatCurrency(amount)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                                        {can_enter_destination && (
                                            <button
                                                onClick={() => setDestinationOrder(refund)}
                                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-text-muted hover:bg-muted"
                                            >
                                                <Banknote className="h-3.5 w-3.5" /> Isi Tujuan
                                            </button>
                                        )}
                                        {can_start && !isConfirming && (
                                            <button
                                                onClick={() => setStartConfirm(order_id)}
                                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white hover:bg-primary-hover"
                                            >
                                                <Play className="h-3.5 w-3.5" /> Mulai
                                            </button>
                                        )}
                                        {can_start && isConfirming && (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleStart(order_id)}
                                                    className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
                                                >
                                                    Konfirmasi
                                                </button>
                                                <button
                                                    onClick={() => setStartConfirm(null)}
                                                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs text-text-muted hover:bg-muted"
                                                >
                                                    Batal
                                                </button>
                                            </div>
                                        )}
                                        {can_reject && (
                                            <button
                                                onClick={() => setRejectionOrder(refund)}
                                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                                            >
                                                <Ban className="h-3.5 w-3.5" /> Tolak
                                            </button>
                                        )}
                                        {can_rollback && (
                                            <button
                                                onClick={() => setRollbackOrder(refund)}
                                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-600 hover:bg-amber-50"
                                            >
                                                <Undo2 className="h-3.5 w-3.5" /> Rollback
                                            </button>
                                        )}
                                        {can_complete && (
                                            <button
                                                onClick={() => setCompletionOrder(refund)}
                                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white hover:bg-primary-hover"
                                            >
                                                <CheckCircle className="h-3.5 w-3.5" /> Selesai
                                            </button>
                                        )}
                                    </div>

                                    {/* Expandable details */}
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(isExpanded ? null : order_id)}
                                        className="flex w-full items-center justify-between border-t border-border px-4 py-2 text-xs font-medium text-text-muted hover:bg-surface-muted"
                                    >
                                        <span>Detail</span>
                                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-border bg-surface-muted/50 px-4 py-3 space-y-3">
                                            {/* Destination */}
                                            {destination && (
                                                <div>
                                                    <p className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
                                                        Tujuan Refund
                                                    </p>
                                                    <div className="mt-1 flex items-start gap-2.5 rounded-lg bg-surface p-2.5 text-xs">
                                                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                                                            {destination.type === 'ewallet' ? <Smartphone className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-medium text-text">{destination.label}</p>
                                                            <p className="text-text-muted">{destination.holder}</p>
                                                            <p className="font-mono text-text-subtle break-all">{destination.number}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(destination.number, order_id)}
                                                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline shrink-0"
                                                            aria-label={copiedId === order_id ? 'Tersalin' : 'Salin nomor'}
                                                        >
                                                            {copiedId === order_id ? (
                                                                <><Check className="h-3 w-3" /> Tersalin</>
                                                            ) : (
                                                                <><Copy className="h-3 w-3" /> Salin</>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Proof & reference */}
                                            {proof_url && (
                                                <div>
                                                    <p className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">Bukti Transfer</p>
                                                    <a
                                                        href={proof_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-medium text-primary hover:underline"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" /> Lihat Bukti
                                                    </a>
                                                </div>
                                            )}
                                            {transfer_reference && (
                                                <div className="text-xs text-text-muted">
                                                    <span className="text-text-subtle">Referensi:</span> {transfer_reference}
                                                </div>
                                            )}
                                            {transfer_note && (
                                                <div className="text-xs text-text-subtle">Catatan: {transfer_note}</div>
                                            )}

                                            {/* Rejection info */}
                                            {rejection && (
                                                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                                                    <p className="font-medium">{rejection.label}</p>
                                                    {rejection.note && <p className="mt-0.5 text-red-600">{rejection.note}</p>}
                                                </div>
                                            )}

                                            {/* Timeline */}
                                            {timeline.length > 0 && (
                                                <div>
                                                    <p className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
                                                        Riwayat ({timeline.length})
                                                    </p>
                                                    <div className="mt-1.5 space-y-1.5">
                                                        {timeline.map((item) => (
                                                            <TimelineItem key={item.id} item={item} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {refunds.links && refunds.links.length > 3 && (
                    <div className="flex items-center justify-center gap-1.5">
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
                                    className={`inline-flex min-h-9 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition-all ${
                                        link.active
                                            ? 'border-primary bg-primary text-white shadow-sm'
                                            : 'border-border text-text-muted hover:border-border-strong hover:text-text'
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

const EVENT_LABELS: Record<string, string> = {
    refund_requested: 'Refund diajukan',
    destination_submitted: 'Tujuan refund disimpan',
    destination_updated: 'Tujuan refund diperbarui',
    guest_destination_submitted_by_owner: 'Tujuan refund oleh owner',
    guest_destination_updated_by_owner: 'Tujuan refund diperbarui owner',
    processing_started: 'Refund mulai diproses',
    processing_rolled_back: 'Refund dikembalikan',
    refund_rejected: 'Refund ditolak',
    refund_reopened: 'Refund dibuka kembali',
    refund_completed: 'Refund selesai',
    refund_failed: 'Refund gagal',
};

function TimelineItem({ item }: { item: RefundHistoryItem }) {
    return (
        <div className="flex items-start gap-2">
            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text">
                    {EVENT_LABELS[item.event] ?? item.event}
                </p>
                {item.note && <p className="text-[11px] text-text-subtle">{item.note}</p>}
                <p className="text-[11px] text-text-subtle">
                    {item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : ''}
                    {item.actor_type && ` · ${item.actor_type}`}
                </p>
            </div>
        </div>
    );
}
