import { router } from '@inertiajs/react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import OwnerLayout from '@/layouts/owner-layout';
import { formatCurrency, formatDate } from '@/lib/format';
import { useState } from 'react';
import RefundProofModal from '@/components/owner/finance/refund-proof-modal';

interface RefundOrder {
    id: number;
    order_code: string;
    total: number;
    payment_status: string;
    refund_reason: string | null;
    refund_requested_at: string | null;
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
}

export default function RefundTab({ refunds }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState<RefundOrder | null>(null);

    const handleReject = (orderId: number) => {
        if (confirm('Tolak refund ini?')) {
            router.post(`/owner/refunds/${orderId}/reject`);
        }
    };

    return (
        <OwnerLayout title="Refund Queue">
            <div className="space-y-4">
                {refunds.data.length === 0 ? (
                    <div className="rounded-xl border border-border bg-surface p-8 text-center">
                        <CheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
                        <p className="mt-2 text-sm text-text-muted">Tidak ada refund yang pending</p>
                    </div>
                ) : (
                    refunds.data.map((order) => (
                        <div key={order.id} className="rounded-xl border border-border bg-surface p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-text">{order.order_code}</div>
                                    <div className="mt-0.5 text-xs text-text-muted">
                                        {order.outlet?.name ?? '-'} · {order.customer?.name ?? '-'}
                                    </div>
                                    <div className="mt-1 text-sm font-bold text-text">{formatCurrency(order.total)}</div>
                                    {order.refund_reason && (
                                        <div className="mt-1 text-xs text-red-600">{order.refund_reason}</div>
                                    )}
                                    <div className="mt-1 text-xs text-text-subtle">
                                        {order.refund_requested_at ? formatDate(order.refund_requested_at) : formatDate(order.updated_at)}
                                    </div>
                                    {order.payment_status === 'refund_pending' && (
                                        <div className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                            Menunggu refund manual
                                        </div>
                                    )}
                                </div>
                                {order.payment_status === 'refund_pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setSelected(order); setModalOpen(true); }}
                                            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white active:opacity-80"
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" /> Refund
                                        </button>
                                        <button
                                            onClick={() => handleReject(order.id)}
                                            className="flex h-9 items-center gap-1.5 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600 active:bg-red-50"
                                        >
                                            <XCircle className="h-3.5 w-3.5" /> Tolak
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selected && (
                <RefundProofModal
                    orderId={selected.id}
                    orderCode={selected.order_code}
                    expectedAmount={selected.total}
                    open={modalOpen}
                    onClose={() => { setModalOpen(false); setSelected(null); }}
                />
            )}
        </OwnerLayout>
    );
}
