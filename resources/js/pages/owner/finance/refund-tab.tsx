import { router } from '@inertiajs/react';
import { RefreshCw, CheckCircle } from 'lucide-react';
import OwnerLayout from '@/layouts/owner-layout';
import { formatCurrency, formatDate } from '@/lib/format';

interface RefundOrder {
    id: number;
    order_code: string;
    total: number;
    refund_reason: string | null;
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
    const handleRetry = (orderId: number) => {
        router.post(`/owner/refunds/${orderId}/retry`);
    };

    const handleResolve = (orderId: number) => {
        router.post(`/owner/refunds/${orderId}/resolve`);
    };

    return (
        <OwnerLayout title="Refund Queue">
            <div className="space-y-4">
                {refunds.data.length === 0 ? (
                    <div className="rounded-xl border border-border bg-white p-8 text-center">
                        <CheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
                        <p className="mt-2 text-sm text-text-muted">Tidak ada refund yang pending</p>
                    </div>
                ) : (
                    refunds.data.map((order) => (
                        <div key={order.id} className="rounded-xl border border-border bg-white p-4">
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
                                    <div className="mt-1 text-xs text-text-subtle">{formatDate(order.updated_at)}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleRetry(order.id)}
                                        className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white active:opacity-80"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                                    </button>
                                    <button
                                        onClick={() => handleResolve(order.id)}
                                        className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-text active:bg-surface-muted"
                                    >
                                        <CheckCircle className="h-3.5 w-3.5" /> Selesai
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </OwnerLayout>
    );
}
