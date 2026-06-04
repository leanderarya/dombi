import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { MapPin, XCircle } from 'lucide-react';
import DeliveryStatusBadge from '../../../components/delivery-status-badge';
import OrderStatusBadge from '../../../components/order-status-badge';
import OutletLayout from '../../../layouts/outlet-layout';

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

    return (
        <OutletLayout>
            <Head title={order.order_code} />
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">{order.order_code}</h1>
                    <p className="mt-1 text-sm text-zinc-500">{order.customer_name}</p>
                </div>
                <OrderStatusBadge status={order.status} />
            </div>
            {errors?.status && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.status}</div>}
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
                <section className="rounded-lg border bg-white p-5">
                    <h2 className="font-semibold">Items</h2>
                    <div className="mt-3 space-y-3">
                        {order.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between border-t pt-3 text-sm">
                                <div><div className="font-medium">{item.product_name}</div><div className="text-zinc-500">Qty {item.quantity} x Rp {Number(item.price).toLocaleString('id-ID')}</div></div>
                                <div className="font-medium">Rp {Number(item.subtotal).toLocaleString('id-ID')}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 border-t pt-4 text-right">
                        <div className="text-xl font-semibold">Rp {Number(order.total).toLocaleString('id-ID')}</div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                        {isPending && (
                            <>
                                <button
                                    onClick={() => updateStatus('confirmed')}
                                    className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
                                >
                                    Terima Pesanan
                                </button>
                                <button
                                    onClick={() => setShowRejectSheet(true)}
                                    className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700"
                                >
                                    Tolak Pesanan
                                </button>
                            </>
                        )}
                        {order.status === 'confirmed' && (
                            <button
                                onClick={() => updateStatus('preparing')}
                                className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white"
                            >
                                Mulai Persiapan
                            </button>
                        )}
                        {order.status === 'preparing' && (
                            <button
                                onClick={() => updateStatus('ready_for_pickup')}
                                className="rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white"
                            >
                                Siap Diambil
                            </button>
                        )}
                        {order.status === 'ready_for_pickup' && !order.delivery && (
                            <span className="rounded-md bg-purple-50 px-4 py-2 text-sm font-medium text-purple-800">Menugaskan Kurir</span>
                        )}
                    </div>

                    {/* Rejection Info */}
                    {order.status === 'rejected_by_outlet' && order.rejection_reason && (
                        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-red-600">Pesanan Ditolak</div>
                            <div className="mt-1 text-sm text-red-800">{order.rejection_reason}</div>
                            {order.rejection_note && <div className="mt-1 text-xs text-red-700">{order.rejection_note}</div>}
                        </div>
                    )}
                </section>
                <aside className="space-y-5">
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Delivery</h2>
                        {order.delivery ? (
                            <div className="mt-3 space-y-2">
                                <DeliveryStatusBadge status={order.delivery.status} />
                                <div>Courier: {order.delivery.courier?.name ?? '-'}</div>
                                <div>Pickup: {order.delivery.pickup_time ? new Date(order.delivery.pickup_time).toLocaleString('id-ID') : '-'}</div>
                                <div>Delivered: {order.delivery.delivered_time ? new Date(order.delivery.delivered_time).toLocaleString('id-ID') : '-'}</div>
                            </div>
                        ) : order.status === 'ready_for_pickup' ? (
                            <form onSubmit={(e) => { e.preventDefault(); assignForm.post(`/outlet/orders/${order.id}/assign-courier`); }} className="mt-3 space-y-3">
                                <select value={assignForm.data.courier_id} onChange={(e) => assignForm.setData('courier_id', e.target.value)} className="w-full rounded-md border px-3 py-2">
                                    {couriers.map((courier: any) => <option key={courier.id} value={courier.id}>{courier.name}</option>)}
                                </select>
                                {assignForm.errors.courier_id && <div className="text-red-600">{assignForm.errors.courier_id}</div>}
                                <button className="w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white">Assign Courier</button>
                            </form>
                        ) : (
                            <div className="mt-3 text-zinc-500">Delivery tersedia setelah ready for pickup.</div>
                        )}
                    </section>
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Customer Info</h2>
                        <div className="mt-3 font-medium">{order.customer_name}</div>
                        <div>{order.customer_phone}</div>
                        <div className="text-zinc-600">{order.customer_address}</div>
                        {order.customer_address_detail && (
                            <div className="mt-1 text-zinc-600"><span className="font-medium text-zinc-500">Detail: </span>{order.customer_address_detail}</div>
                        )}
                        {order.customer_landmark && (
                            <div className="mt-1 text-zinc-600"><span className="font-medium text-zinc-500">Patokan: </span>{order.customer_landmark}</div>
                        )}
                        {order.latitude && order.longitude && (
                            <a
                                href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex min-h-[36px] items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 active:bg-emerald-100"
                            >
                                <MapPin className="h-4 w-4" />
                                Buka di Maps
                            </a>
                        )}
                        {order.notes && <div className="mt-3 rounded-md bg-zinc-50 p-3">{order.notes}</div>}
                    </section>
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Timeline</h2>
                        <div className="mt-3 space-y-3">
                            {order.status_histories.map((history: any) => (
                                <div key={history.id} className="border-l-2 border-emerald-200 pl-3">
                                    <div className="font-medium">{history.to_status.replaceAll('_', ' ')}</div>
                                    <div className="text-zinc-500">{history.notes}</div>
                                    {history.reason && <div className="text-xs text-zinc-400">Alasan: {history.reason}</div>}
                                    <div className="text-xs text-zinc-400">{new Date(history.created_at).toLocaleString('id-ID')} {history.actor ? `oleh ${history.actor.name}` : ''}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>

            {/* Reject Sheet */}
            {showRejectSheet && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40" onClick={() => setShowRejectSheet(false)}>
                    <div
                        className="flex w-full max-w-lg flex-col rounded-t-3xl bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-16px_40px_rgba(15,23,42,0.16)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />
                        <div className="mt-3 flex items-center justify-between">
                            <h2 className="text-[15px] font-semibold text-slate-900">Tolak Pesanan</h2>
                            <button type="button" onClick={() => setShowRejectSheet(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 active:bg-slate-100">
                                <XCircle className="h-4 w-4" />
                            </button>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">Pilih alasan penolakan.</p>

                        <div className="mt-4 space-y-2">
                            {rejectionReasons.map((reason: string) => (
                                <button
                                    key={reason}
                                    type="button"
                                    onClick={() => rejectForm.setData('reason', reason)}
                                    className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${
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

                        {rejectForm.errors.reason && (
                            <p className="mt-2 text-xs text-red-600">{rejectForm.errors.reason}</p>
                        )}
                        {rejectForm.errors.note && (
                            <p className="mt-1 text-xs text-red-600">{rejectForm.errors.note}</p>
                        )}

                        <button
                            type="button"
                            onClick={handleReject}
                            disabled={!rejectForm.data.reason || rejectForm.processing}
                            className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white active:bg-red-700 disabled:bg-slate-300"
                        >
                            {rejectForm.processing ? 'Menolak...' : 'Tolak Pesanan'}
                        </button>
                    </div>
                </div>
            )}
        </OutletLayout>
    );
}
