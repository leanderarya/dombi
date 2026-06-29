import { Head, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { useState } from 'react';
import BottomSheet from '@/components/ui/bottom-sheet';
import Dialog from '@/components/ui/dialog';
import SectionCard from '@/components/ui/section-card';
import { isDifferentRecipient } from '@/lib/recipient';
import StatusBadge from '@/components/ui/status-badge';
import StickyActionBar from '@/components/ui/sticky-action-bar';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency } from '@/lib/format';
import { getOrderStatus } from '@/lib/status-labels';

const STATUS_CONFIRM_LABELS: Record<string, { title: string; message: string; confirm: string }> = {
    confirmed: {
        title: 'Terima Pesanan?',
        message: 'Pesanan akan diterima dan diproses.',
        confirm: 'Ya, Terima',
    },
    preparing: {
        title: 'Mulai Persiapan?',
        message: 'Pesanan akan mulai disiapkan.',
        confirm: 'Ya, Mulai',
    },
    ready_for_pickup: {
        title: 'Pesanan Siap?',
        message: 'Pesanan sudah selesai disiapkan dan siap diambil.',
        confirm: 'Ya, Siap',
    },
};

export default function OutletOrderShow({ order, couriers, rejectionReasons = [] }: any) {
    const { errors } = usePage<any>().props;
    const assignForm = useForm({ courier_id: couriers[0]?.id ?? '' });
    const rejectForm = useForm({ reason: '', note: '' });
    const statusForm = useForm({ status: '' });
    const completeForm = useForm({});
    const [showRejectSheet, setShowRejectSheet] = useState(false);
    const [showAssignSheet, setShowAssignSheet] = useState(false);
    const [confirmAction, setConfirmAction] = useState<string | null>(null);

    const updateStatus = (status: string) => {
        statusForm.setData('status', status);
        statusForm.post(`/outlet/orders/${order.id}/status`, {
            onSuccess: () => setConfirmAction(null),
        });
    };

    const handleReject = () => {
        rejectForm.post(`/outlet/orders/${order.id}/reject`, {
            onSuccess: () => setShowRejectSheet(false),
        });
    };

    const handleCompletePickup = () => {
        completeForm.post(`/outlet/orders/${order.id}/complete-pickup`, {
            onSuccess: () => setConfirmAction(null),
        });
    };

    const isPending = order.status === 'pending_confirmation';
    const isConfirmed = order.status === 'confirmed';
    const isPreparing = order.status === 'preparing';
    const isDeliveryOrder = order.fulfillment_type !== 'pickup';
    const isReadyForPickup = order.status === 'ready_for_pickup' && !order.delivery && isDeliveryOrder;
    const isReadyForCustomerPickup = order.status === 'ready_for_pickup' && order.fulfillment_type === 'pickup';

    // Build sticky actions
    const actions = [];

    if (isPending) {
        actions.push({
            label: 'Terima Pesanan',
            variant: 'primary' as const,
            onClick: () => setConfirmAction('confirmed'),
        });
        actions.push({
            label: 'Tolak',
            variant: 'secondary' as const,
            onClick: () => setShowRejectSheet(true),
        });
    }

    if (isConfirmed) {
        actions.push({
            label: 'Mulai Persiapan',
            variant: 'primary' as const,
            onClick: () => setConfirmAction('preparing'),
        });
    }

    if (isPreparing) {
        actions.push({
            label: 'Siap Diambil',
            variant: 'primary' as const,
            onClick: () => setConfirmAction('ready_for_pickup'),
        });
    }

    if (isReadyForPickup && !order.delivery) {
        actions.push({
            label: 'Assign Kurir',
            variant: 'primary' as const,
            onClick: () => setShowAssignSheet(true),
        });
    }

    return (
        <OutletLayout title={order.order_code} backHref="/outlet/orders" hideNav>
            <Head title={order.order_code} />

            <div className="mt-4">
            {/* Items */}
            <SectionCard label="Pesanan">
                {errors?.status && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.status}</div>}
                <div className="space-y-2">
                    {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                            <div>
                                <span className="font-medium text-text">{item.product_name}</span>
                                <span className="ml-2 text-text-muted">x{item.quantity}</span>
                            </div>
                            <span className="font-medium tabular-nums text-text">{formatCurrency(item.subtotal)}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 border-t border-border pt-3 flex justify-between">
                    <span className="text-sm font-medium text-text-muted">Total</span>
                    <span className="text-base font-bold tabular-nums text-text">{formatCurrency(order.total)}</span>
                </div>
            </SectionCard>

            {/* Customer / Recipient */}
            <SectionCard label={isDifferentRecipient(order) ? 'Pemesan' : 'Customer'}>
                {isDifferentRecipient(order) && (
                    <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-200">
                        <AlertTriangle className="h-3 w-3" />
                        BEDA PENERIMA
                    </div>
                )}

                <div className="space-y-1.5 text-sm">
                    <div className="font-semibold text-text">{order.customer_name}</div>
                    <div className="text-text-muted">{order.customer_phone}</div>
                    <div className="text-text-muted">{order.customer_address}</div>
                    {order.customer_address_detail && (
                        <div className="text-text-subtle">Detail: {order.customer_address_detail}</div>
                    )}
                    {order.customer_landmark && (
                        <div className="text-text-subtle">Patokan: {order.customer_landmark}</div>
                    )}
                </div>

                {isDifferentRecipient(order) && (
                    <div className="mt-3 border-t border-border pt-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">Penerima</div>
                        <div className="mt-1.5 space-y-1.5 text-sm">
                            <div className="font-semibold text-text">{order.recipient_name}</div>
                            <div className="text-text-muted">{order.recipient_phone ?? '-'}</div>
                        </div>
                    </div>
                )}

                {order.latitude && order.longitude && (
                    <a
                        href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm font-medium text-text active:opacity-80"
                    >
                        <MapPin className="h-4 w-4" />
                        Buka di Maps
                    </a>
                )}
            </SectionCard>

            {/* Delivery / Pickup Status */}
            <SectionCard label="Pengiriman">
                {order.delivery ? (
                    <div className="space-y-2">
                        <StatusBadge status={order.delivery.status} />
                        <div className="text-sm text-text-muted">Kurir: <span className="font-medium text-text">{order.delivery.courier?.name ?? '-'}</span></div>
                        {order.delivery.pickup_time && (
                            <div className="text-sm text-text-muted">Pickup: {new Date(order.delivery.pickup_time).toLocaleString('id-ID')}</div>
                        )}
                        {order.delivery.delivered_time && (
                            <div className="text-sm text-text-muted">Selesai: {new Date(order.delivery.delivered_time).toLocaleString('id-ID')}</div>
                        )}
                    </div>
                ) : isReadyForCustomerPickup ? (
                    <div>
                        <div className="text-sm font-medium text-text">Siap Diambil Customer</div>
                        <div className="mt-1 text-xs text-text-muted">Serahkan ke customer saat datang mengambil.</div>
                        <button
                            onClick={() => setConfirmAction('complete_pickup')}
                            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-bold text-white active:opacity-80"
                        >
                            Serahkan ke Customer
                        </button>
                    </div>
                ) : isReadyForPickup ? (
                    <div className="text-sm text-text-muted">Siap assign kurir untuk pengiriman.</div>
                ) : isDeliveryOrder ? (
                    <div className="text-sm text-text-muted">Delivery tersedia setelah siap diambil.</div>
                ) : (
                    <div className="text-sm text-text-muted">Pickup — customer ambil di outlet.</div>
                )}
            </SectionCard>

            {/* Notes */}
            {(order.status === 'rejected_by_outlet' && order.rejection_reason) || order.notes ? (
                <SectionCard label="Catatan">
                    {order.status === 'rejected_by_outlet' && order.rejection_reason && (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <StatusBadge variant="danger" size="sm">Ditolak</StatusBadge>
                                <span className="text-sm font-medium text-red-700">Pesanan Ditolak</span>
                            </div>
                            <div className="text-sm text-text">{order.rejection_reason}</div>
                            {order.rejection_note && <div className="text-xs text-text-muted">{order.rejection_note}</div>}
                        </div>
                    )}
                    {order.notes && (
                        <div className={order.status === 'rejected_by_outlet' && order.rejection_reason ? 'mt-3 border-t border-border pt-3' : ''}>
                            <div className="text-sm text-text">{order.notes}</div>
                        </div>
                    )}
                </SectionCard>
            ) : null}

            {/* Timeline */}
            {order.status_histories?.length > 0 && (
                <SectionCard label="Timeline">
                    <div className="space-y-3">
                        {order.status_histories.map((history: any) => (
                            <div key={history.id} className="border-l-2 border-border pl-3">
                                <div className="text-sm font-medium text-text">{getOrderStatus(history.to_status).label}</div>
                                {history.notes && <div className="text-xs text-text-muted">{history.notes}</div>}
                                {history.reason && <div className="text-xs text-text-subtle">Alasan: {history.reason}</div>}
                                <div className="text-[11px] text-text-subtle">{new Date(history.created_at).toLocaleString('id-ID')} {history.actor ? `oleh ${history.actor.name}` : ''}</div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
            </div>

            {/* Sticky Actions */}
            {actions.length > 0 && <StickyActionBar actions={actions} />}
            {actions.length > 0 && <div className="h-20" />}

            {/* Status Confirmation Dialog */}
            {confirmAction && confirmAction !== 'complete_pickup' && (
                <Dialog open={true} onClose={() => setConfirmAction(null)} title={STATUS_CONFIRM_LABELS[confirmAction]?.title ?? 'Konfirmasi'}>
                    <p className="text-sm text-text-muted">{STATUS_CONFIRM_LABELS[confirmAction]?.message ?? ''}</p>
                    <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setConfirmAction(null)}
                            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={() => updateStatus(confirmAction)}
                            disabled={statusForm.processing}
                            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                        >
                            {statusForm.processing ? 'Memproses...' : STATUS_CONFIRM_LABELS[confirmAction]?.confirm ?? 'Ya'}
                        </button>
                    </div>
                </Dialog>
            )}

            {/* Complete Pickup Confirmation Dialog */}
            {confirmAction === 'complete_pickup' && (
                <Dialog open={true} onClose={() => setConfirmAction(null)} title="Serahkan Pesanan?">
                    <p className="text-sm text-text-muted">Pastikan customer sudah menerima pesanan.</p>
                    <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setConfirmAction(null)}
                            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleCompletePickup}
                            disabled={completeForm.processing}
                            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                        >
                            {completeForm.processing ? 'Memproses...' : 'Ya, Serahkan'}
                        </button>
                    </div>
                </Dialog>
            )}

            {/* Assign Courier Sheet */}
            <BottomSheet open={showAssignSheet} onClose={() => setShowAssignSheet(false)} title="Assign Kurir">
                <form onSubmit={(e) => {
                    e.preventDefault();
                    assignForm.post(`/outlet/orders/${order.id}/assign-courier`, {
                        onSuccess: () => setShowAssignSheet(false),
                    });
                }} className="space-y-4">
                    <div>
                        <label className="mb-2 block text-[13px] text-text-subtle">Pilih Kurir</label>
                        <select
                            value={assignForm.data.courier_id}
                            onChange={(e) => assignForm.setData('courier_id', e.target.value)}
                            className="w-full min-h-11 rounded-xl border border-border px-4 text-sm"
                        >
                            {couriers.map((courier: any) => (
                                <option key={courier.id} value={courier.id}>{courier.name}</option>
                            ))}
                        </select>
                        {assignForm.errors.courier_id && (
                            <div className="mt-1 text-xs text-red-600">{assignForm.errors.courier_id}</div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={assignForm.processing}
                        className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                    >
                        {assignForm.processing ? 'Mengassign...' : 'Assign Kurir'}
                    </button>
                </form>
            </BottomSheet>

            {/* Reject Sheet */}
            <BottomSheet open={showRejectSheet} onClose={() => setShowRejectSheet(false)} title="Tolak Pesanan">
                <p className="text-sm text-text-muted">Pilih alasan penolakan.</p>

                <div className="mt-4 space-y-2">
                    {rejectionReasons.map((reason: string) => (
                        <button
                            key={reason}
                            type="button"
                            onClick={() => rejectForm.setData('reason', reason)}
                            className={`flex h-11 w-full items-center rounded-lg border px-4 text-left text-sm font-medium transition-all ${
                                rejectForm.data.reason === reason
                                    ? 'border-primary bg-primary-light text-primary'
                                    : 'border-border text-text active:bg-surface-muted'
                            }`}
                        >
                            {reason}
                        </button>
                    ))}
                </div>

                {rejectForm.data.reason === 'Lainnya' && (
                    <div className="mt-3">
                        <textarea
                            value={rejectForm.data.note}
                            onChange={(e) => rejectForm.setData('note', e.target.value)}
                            placeholder="Jelaskan alasan penolakan..."
                            className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                    </div>
                )}

                {rejectForm.errors.reason && <p className="mt-2 text-xs text-red-600">{rejectForm.errors.reason}</p>}
                {rejectForm.errors.note && <p className="mt-1 text-xs text-red-600">{rejectForm.errors.note}</p>}

                <button
                    type="button"
                    onClick={handleReject}
                    disabled={!rejectForm.data.reason || rejectForm.processing}
                    className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                >
                    {rejectForm.processing ? 'Menolak...' : 'Tolak Pesanan'}
                </button>
            </BottomSheet>
        </OutletLayout>
    );
}
