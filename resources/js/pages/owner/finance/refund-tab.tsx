import { Link, router } from '@inertiajs/react';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle, XCircle, Play, Ban } from 'lucide-react';
import OwnerLayout from '@/layouts/owner-layout';
import { formatCurrency, formatDate } from '@/lib/format';
import { useState } from 'react';
import RefundCompletionModal from '@/components/owner/finance/refund-completion-modal';
import RefundRejectionModal from '@/components/owner/finance/refund-rejection-modal';

const FILTERS = [
    { value: 'awaiting_destination', label: 'Menunggu Data Customer' },
    { value: 'ready', label: 'Siap Diproses' },
    { value: 'in_progress', label: 'Sedang Diproses' },
    { value: 'completed', label: 'Selesai' },
    { value: 'rejected', label: 'Ditolak' },
] as const;

interface RefundOrder {
    id: number;
    order_code: string;
    total: number;
    payment_status: string;
    refund_reason: string | null;
    refund_requested_at: string | null;
    refund_amount: string | null;
    refund_proof_image: string | null;
    refund_transfer_reference: string | null;
    refund_transfer_note: string | null;
    refund_rejected_reason: string | null;
    refund_rejection_note: string | null;
    refund_started_at: string | null;
    refunded_at: string | null;
    refund_destination_type: string | null;
    refund_bank_name: string | null;
    refund_account_number: string | null;
    refund_account_holder: string | null;
    refund_ewallet_provider: string | null;
    refund_ewallet_number: string | null;
    refund_ewallet_holder: string | null;
    updated_at: string;
    outlet: { name: string } | null;
    customer: { name: string } | null;
}

interface Props {
    refunds: {
        data: RefundOrder[];
        current_page: number;
        last_page: number;
    };
    filter: string;
}

export default function RefundTab({ refunds, filter }: Props) {
    const [startConfirm, setStartConfirm] = useState<number | null>(null);
    const [completionOrder, setCompletionOrder] = useState<RefundOrder | null>(null);
    const [rejectionOrder, setRejectionOrder] = useState<RefundOrder | null>(null);

    const handleStart = (orderId: number) => {
        router.post(`/owner/refunds/${orderId}/start`, {}, {
            onSuccess: () => { toast.success('Proses refund dimulai'); setStartConfirm(null); },
            onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
        });
    };

    return (
        <OwnerLayout title="Refund Queue">
            <div className="space-y-4">
                {/* Filter tabs */}
                <div className="flex flex-wrap gap-2">
                    {FILTERS.map((f) => (
                        <Link
                            key={f.value}
                            href={`/owner/refunds?filter=${f.value}`}
                            preserveState
                            preserveScroll
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                filter === f.value
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-text-muted hover:bg-muted'
                            }`}
                        >
                            {f.label}
                        </Link>
                    ))}
                </div>

                {refunds.data.length === 0 ? (
                    <div className="rounded-xl border border-border bg-surface p-8 text-center">
                        <CheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
                        <p className="mt-2 text-sm text-text-muted">
                            Tidak ada refund
                        </p>
                    </div>
                ) : (
                    refunds.data.map((order) => (
                        <div
                            key={order.id}
                            className="rounded-xl border border-border bg-surface p-4"
                        >
                            <div className="flex items-start justify-between">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-text">
                                        {order.order_code}
                                    </div>
                                    <div className="mt-0.5 text-xs text-text-muted">
                                        {order.outlet?.name ?? '-'} ·{' '}
                                        {order.customer?.name ?? '-'}
                                    </div>
                                    <div className="mt-1 text-sm font-bold text-text">
                                        {formatCurrency(Number(order.refund_amount || order.total))}
                                    </div>
                                    {order.refund_requested_at && (
                                        <div className="mt-1 text-xs text-text-subtle">
                                            {formatDate(order.refund_requested_at)}
                                        </div>
                                    )}

                                    {/* Destination */}
                                    {order.refund_destination_type && (
                                        <div className="mt-2 rounded bg-muted p-2 text-xs">
                                            {order.refund_destination_type === 'bank' ? (
                                                <p>{order.refund_bank_name} — {order.refund_account_holder} ({order.refund_account_number})</p>
                                            ) : (
                                                <p>{order.refund_ewallet_provider} — {order.refund_ewallet_holder} ({order.refund_ewallet_number})</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Rejection */}
                                    {order.refund_rejected_reason && (
                                        <div className="mt-2 text-xs text-red-600">
                                            {order.refund_rejected_reason}
                                            {order.refund_rejection_note && <>: {order.refund_rejection_note}</>}
                                        </div>
                                    )}

                                    {/* Transfer reference */}
                                    {order.refund_transfer_reference && (
                                        <div className="mt-1 text-xs text-text-muted">
                                            Ref: {order.refund_transfer_reference}
                                        </div>
                                    )}
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    {order.payment_status === 'refund_pending' && order.refund_destination_submitted_at && (
                                        <>
                                            {startConfirm === order.id ? (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleStart(order.id)}
                                                        className="flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-xs font-bold text-white"
                                                    >
                                                        Konfirmasi Mulai
                                                    </button>
                                                    <button
                                                        onClick={() => setStartConfirm(null)}
                                                        className="flex h-8 items-center gap-1 rounded-lg border px-2 text-xs text-text-muted"
                                                    >
                                                        Batal
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setStartConfirm(order.id)}
                                                    className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white"
                                                >
                                                    <Play className="h-3.5 w-3.5" /> Mulai
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setRejectionOrder(order)}
                                                className="flex h-9 items-center gap-1.5 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600"
                                            >
                                                <Ban className="h-3.5 w-3.5" /> Tolak
                                            </button>
                                        </>
                                    )}

                                    {order.payment_status === 'refund_in_progress' && (
                                        <button
                                            onClick={() => setCompletionOrder(order)}
                                            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white"
                                        >
                                            <CheckCircle className="h-3.5 w-3.5" /> Selesai
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {completionOrder && (
                <RefundCompletionModal
                    orderId={completionOrder.id}
                    orderCode={completionOrder.order_code}
                    amount={Number(completionOrder.refund_amount || completionOrder.total)}
                    open={!!completionOrder}
                    onClose={() => setCompletionOrder(null)}
                />
            )}

            {rejectionOrder && (
                <RefundRejectionModal
                    orderId={rejectionOrder.id}
                    orderCode={rejectionOrder.order_code}
                    open={!!rejectionOrder}
                    onClose={() => setRejectionOrder(null)}
                />
            )}
        </OwnerLayout>
    );
}
