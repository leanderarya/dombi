import { Head, router, useForm, usePage } from '@inertiajs/react';
import { getOrderStatus } from '@/lib/status-labels';
import { MapPin, XCircle } from 'lucide-react';
import { useState } from 'react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import OrderStatusBadge from '@/components/order-status-badge';
import BottomSheet from '@/components/ui/bottom-sheet';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import StickyActionBar from '@/components/ui/sticky-action-bar';
import OutletLayout from '@/layouts/outlet-layout';

export default function OutletOrderShow({ order, couriers, rejectionReasons = [] }: any) {
    const { errors } = usePage<any>().props;
    const assignForm = useForm({ courier_id: couriers[0]?.id ?? '' });
    const rejectForm = useForm({ reason: '', note: '' });
    const [showRejectSheet, setShowRejectSheet] = useState(false);

    const updateStatus = (status: string) => {
        router.post(`/outlet/orders/${order.id}/status`, { status });
    };

    const handleReject = () => {
        rejectForm.post(`/outlet/orders/${order.id}/reject`, {
            onSuccess: () => setShowRejectSheet(false),
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
            onClick: () => updateStatus('confirmed'),
        });
        actions.push({
            label: 'Tolak Pesanan',
            variant: 'danger' as const,
            onClick: () => setShowRejectSheet(true),
        });
    }

    if (isConfirmed) {
        actions.push({
            label: 'Mulai Persiapan',
            variant: 'primary' as const,
            onClick: () => updateStatus('preparing'),
        });
    }

    if (isPreparing) {
        actions.push({
            label: 'Siap Diambil',
            variant: 'primary' as const,
            onClick: () => updateStatus('ready_for_pickup'),
        });
    }

    return (
        <OutletLayout title={order.order_code} backHref="/outlet/orders" hideNav>
            <Head title={order.order_code} />

            {/* Status Strip */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <div className="text-sm text-slate-500">{order.customer_name}</div>
                </div>
                <OrderStatusBadge status={order.status} />
            </div>

            {errors?.status && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.status}</div>}

            {/* Order: Items + Delivery */}
            <SectionCard label="Pesanan">
                <div className="mt-2 space-y-2">
                    {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                            <div>
                                <span className="font-medium">{item.product_name}</span>
                                <span className="ml-2 text-slate-500">x{item.quantity}</span>
                            </div>
                            <span className="font-medium">Rp {Number(item.subtotal).toLocaleString('id-ID')}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 border-t pt-3 text-right">
                    <span className="text-lg font-semibold">Rp {Number(order.total).toLocaleString('id-ID')}</span>
                </div>

                <div className="mt-4 border-t border-border pt-4">
                    <div className="mb-2 text-[13px] text-text-subtle">Pengiriman</div>
                    {order.delivery ? (
                        <div className="space-y-2">
                            <DeliveryStatusBadge status={order.delivery.status} />
                            <div className="text-sm">Kurir: {order.delivery.courier?.name ?? '-'}</div>
                            <div className="text-sm">Pickup: {order.delivery.pickup_time ? new Date(order.delivery.pickup_time).toLocaleString('id-ID') : '-'}</div>
                            <div className="text-sm">Selesai: {order.delivery.delivered_time ? new Date(order.delivery.delivered_time).toLocaleString('id-ID') : '-'}</div>
                        </div>
                    ) : isReadyForPickup ? (
                        <form onSubmit={(e) => {
 e.preventDefault(); assignForm.post(`/outlet/orders/${order.id}/assign-courier`); 
}} className="space-y-3">
                            <select value={assignForm.data.courier_id} onChange={(e) => assignForm.setData('courier_id', e.target.value)} className="w-full min-h-[44px] rounded-lg border border-zinc-200 px-3 text-sm">
                                {couriers.map((courier: any) => <option key={courier.id} value={courier.id}>{courier.name}</option>)}
                            </select>
                            {assignForm.errors.courier_id && <div className="text-xs text-red-600">{assignForm.errors.courier_id}</div>}
                            <button className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white active:bg-emerald-800">Assign Kurir</button>
                        </form>
                    ) : isReadyForCustomerPickup ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <div className="text-sm font-semibold text-emerald-700">Siap Diambil Customer</div>
                            <div className="mt-1 text-xs text-emerald-600">
                                Pesanan sudah siap. Serahkan ke customer saat datang mengambil.
                            </div>
                            <button
                                onClick={() => router.post(`/outlet/orders/${order.id}/complete-pickup`)}
                                className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white active:bg-emerald-700"
                            >
                                Serahkan ke Customer
                            </button>
                        </div>
                    ) : (
                        <div className="text-sm text-zinc-500">Delivery tersedia setelah siap diambil.</div>
                    )}
                </div>
            </SectionCard>

            {/* Customer + Notes + Rejection */}
            <SectionCard label="Customer">
                <div className="space-y-1.5 text-sm">
                    <div className="font-medium">{order.customer_name}</div>
                    <div className="text-slate-600">{order.customer_phone}</div>
                    <div className="text-slate-600">{order.customer_address}</div>
                    {order.customer_address_detail && (
                        <div className="text-slate-500">Detail: {order.customer_address_detail}</div>
                    )}
                    {order.customer_landmark && (
                        <div className="text-slate-500">Patokan: {order.customer_landmark}</div>
                    )}
                </div>
                {order.latitude && order.longitude && (
                    <a
                        href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:bg-zinc-50"
                    >
                        <MapPin className="h-4 w-4" />
                        Buka di Maps
                    </a>
                )}

                {order.status === 'rejected_by_outlet' && order.rejection_reason && (
                    <div className="mt-4 border-t border-border pt-4">
                        <div className="flex items-center gap-2">
                            <StatusBadge variant="danger" size="sm">Ditolak</StatusBadge>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pesanan Ditolak</span>
                        </div>
                        <div className="mt-1 text-sm text-slate-700">{order.rejection_reason}</div>
                        {order.rejection_note && <div className="mt-1 text-xs text-slate-500">{order.rejection_note}</div>}
                    </div>
                )}

                {order.notes && (
                    <div className="mt-4 border-t border-border pt-4">
                        <div className="mb-2 text-[13px] text-text-subtle">Catatan</div>
                        <div className="rounded-lg bg-zinc-50 p-3 text-sm">{order.notes}</div>
                    </div>
                )}
            </SectionCard>

            {/* Timeline */}
            <SectionCard label="Timeline">
                <div className="mt-2 space-y-3">
                    {order.status_histories.map((history: any) => (
                        <div key={history.id} className="border-l-2 border-emerald-200 pl-3">
                            <div className="text-sm font-medium">{getOrderStatus(history.to_status).label}</div>
                            <div className="text-xs text-zinc-500">{history.notes}</div>
                            {history.reason && <div className="text-xs text-zinc-400">Alasan: {history.reason}</div>}
                            <div className="text-xs text-zinc-400">{new Date(history.created_at).toLocaleString('id-ID')} {history.actor ? `oleh ${history.actor.name}` : ''}</div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Sticky Actions */}
            {actions.length > 0 && <StickyActionBar actions={actions} />}
            {actions.length > 0 && <div className="h-20" />}

            {/* Reject Sheet */}
            <BottomSheet open={showRejectSheet} onClose={() => setShowRejectSheet(false)} title="Tolak Pesanan">
                <p className="text-sm text-slate-500">Pilih alasan penolakan.</p>

                <div className="mt-4 space-y-2">
                    {rejectionReasons.map((reason: string) => (
                        <button
                            key={reason}
                            type="button"
                            onClick={() => rejectForm.setData('reason', reason)}
                            className={`flex h-11 w-full items-center rounded-lg border px-4 text-left text-sm font-medium transition-all ${
                                rejectForm.data.reason === reason
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 text-slate-700 active:bg-slate-50'
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
                            className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>
                )}

                {rejectForm.errors.reason && <p className="mt-2 text-xs text-red-600">{rejectForm.errors.reason}</p>}
                {rejectForm.errors.note && <p className="mt-1 text-xs text-red-600">{rejectForm.errors.note}</p>}

                <button
                    type="button"
                    onClick={handleReject}
                    disabled={!rejectForm.data.reason || rejectForm.processing}
                    className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white active:bg-red-700 disabled:bg-slate-300"
                >
                    {rejectForm.processing ? 'Menolak...' : 'Tolak Pesanan'}
                </button>
            </BottomSheet>
        </OutletLayout>
    );
}
