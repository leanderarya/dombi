import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

import DeliverySlaBadge from '@/components/operations/delivery-sla-badge';
import DeliveryTimeline from '@/components/operations/delivery-timeline';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDeliveryAge } from '@/lib/format';
import { getDeliveryStatus } from '@/lib/status-labels';

const nextExternalActions: Record<string, Array<{
    status: string;
    label: string;
    destructive?: boolean;
    requiresReason?: boolean;
}>> = {
    waiting_pickup: [{ status: 'picked_up', label: 'Kurir sudah mengambil' }],
    picked_up: [{ status: 'delivering', label: 'Mulai pengiriman' }],
    delivering: [
        { status: 'completed', label: 'Pesanan diterima' },
        { status: 'failed', label: 'Pengiriman gagal', destructive: true, requiresReason: true },
    ],
    failed: [
        { status: 'returned_to_outlet', label: 'Konfirmasi kembali ke outlet', requiresReason: true },
    ],
};

export default function OutletDeliveryShow({ delivery }: any) {
    const order = delivery.order;
    const isExternal = delivery.courier_type === 'eksternal';
    const actions = nextExternalActions[delivery.status] ?? [];

    const [showReasonInput, setShowReasonInput] = useState<{ status: string; label: string } | null>(null);
    const [reason, setReason] = useState('');

    function handleAction(status: string, label: string) {
        const action = actions.find((a) => a.status === status);

        if (action?.requiresReason) {
            setShowReasonInput({ status, label });

            return;
        }

        router.post(`/outlet/deliveries/${delivery.id}/status`, { status });
    }

    function submitWithReason() {
        if (!showReasonInput || !reason.trim()) {
return;
}

        router.post(`/outlet/deliveries/${delivery.id}/status`, {
            status: showReasonInput.status,
            reason: reason.trim(),
        }, {
            onSuccess: () => {
                setShowReasonInput(null);
                setReason('');
            },
        });
    }

    return (
        <OutletLayout title={delivery.order_code} backHref="/outlet/deliveries">
            <Head title={delivery.order_code} />

            {/* Status Strip */}
            <div className="mt-4 mb-4 flex items-center justify-between">
                <div className="text-sm text-text-muted">
                    Kurir: {isExternal
                        ? `${delivery.external_provider ?? ''} - ${delivery.external_courier_name ?? ''}`
                        : delivery.courier?.name ?? '-'}
                </div>
                <div className="flex items-center gap-2">
                    <StatusBadge status={delivery.status} />
                    {delivery.sla_health && (
                        <DeliverySlaBadge health={delivery.sla_health} />
                    )}
                </div>
            </div>

            {/* External Action Buttons */}
            {isExternal && actions.length > 0 && (
                <SectionCard label="Perbarui Status Kiriman">
                    <div className="mt-2 flex flex-wrap gap-2">
                        {actions.map((action) => (
                            <button
                                key={action.status}
                                type="button"
                                onClick={() => handleAction(action.status, action.label)}
                                className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                                    action.destructive
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : 'bg-emerald-700 text-white hover:bg-emerald-800'
                                }`}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Reason Modal */}
            {showReasonInput && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                        <h3 className="text-sm font-bold">
                            {showReasonInput.label}
                        </h3>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Alasan..."
                            className="mt-3 w-full rounded-lg border border-slate-200 p-3 text-sm"
                            rows={3}
                        />
                        <div className="mt-3 flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
 setShowReasonInput(null); setReason(''); 
}}
                                className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={submitWithReason}
                                disabled={!reason.trim()}
                                className="flex-1 rounded-lg bg-emerald-700 py-2 text-xs font-bold text-white disabled:bg-slate-300"
                            >
                                Konfirmasi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Info */}
            <SectionCard label="Customer">
                <div className="mt-2 space-y-1.5 text-sm">
                    <div className="font-medium">{delivery.customer_name}</div>
                    <div className="text-text-muted">{delivery.customer_address}</div>
                    {delivery.customer_phone && (
                        <div className="text-text-muted">{delivery.customer_phone}</div>
                    )}
                    {delivery.delivery_age != null && (
                        <div>
                            <span className="text-text-muted">Usia:</span>{' '}
                            <span className={delivery.delivery_age > 60 ? 'font-medium text-red-600' : ''}>
                                {formatDeliveryAge(delivery.delivery_age)}
                            </span>
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* Items */}
            <SectionCard label="Pesanan">
                <div className="mt-2 space-y-2">
                    {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                            <div>
                                <span className="font-medium">{item.product_name}</span>
                                <span className="ml-2 text-text-muted">x{item.quantity}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex justify-between border-t pt-3 text-sm font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                </div>
            </SectionCard>

            {/* Failed Reason */}
            {delivery.failed_reason && (
                <SectionCard>
                    <div className="flex items-center gap-2">
                        <StatusBadge variant="danger" size="sm">Gagal</StatusBadge>
                        <span className="text-xs font-bold tracking-wider text-text-subtle uppercase">Alasan Gagal</span>
                    </div>
                    <p className="mt-1 text-sm text-text">{delivery.failed_reason}</p>
                </SectionCard>
            )}

            {/* Resolution */}
            {delivery.resolution_status && (
                <SectionCard>
                    <div className="flex items-center gap-2">
                        <StatusBadge variant="warning" size="sm">Resolusi</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-text">{getDeliveryStatus(delivery.resolution_status).label}</p>
                    {delivery.resolution_notes && (
                        <p className="mt-1 text-xs text-text-muted">{delivery.resolution_notes}</p>
                    )}
                </SectionCard>
            )}

            {/* Timeline */}
            <SectionCard label="Timeline">
                <div className="mt-2">
                    <DeliveryTimeline histories={delivery.status_histories ?? []} />
                </div>
            </SectionCard>
        </OutletLayout>
    );
}
