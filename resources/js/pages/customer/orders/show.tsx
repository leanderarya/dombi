import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, Copy, MapPin, Share2, Truck, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import OrderSummaryCard from '@/components/customer/order-summary-card';
import OrderTimeline from '@/components/customer/order-timeline';
import StickyOrderActions from '@/components/customer/sticky-order-actions';
import OfflineBanner from '@/components/offline-banner';
import { orderStatusLabel, orderStatusTone, activeOrderStatuses } from '@/lib/customer-status';
import { formatDate } from '@/lib/format';
import { useOrderRecovery } from '@/lib/order-recovery';

export default function OrderShow({ order, cancellationReasons = [] }: any) {
    const isActive = activeOrderStatuses.includes(order.status);
    const isTerminal = ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'].includes(order.status);
    const isPending = order.status === 'pending_confirmation';
    const isExpired = order.status === 'expired';
    const { addOrder } = useOrderRecovery();
    const [copied, setCopied] = useState(false);
    const [showCancelSheet, setShowCancelSheet] = useState(false);

    const cancelForm = useForm({
        reason: '',
        note: '',
    });

    useEffect(() => {
        if (order.customer_phone && order.order_code) {
            addOrder(order.customer_phone, order.order_code);
        }
    }, [order.customer_phone, order.order_code, addOrder]);

    const trackingUrl = order.tracking_url
        ?? (order.recovery_token ? `${window.location.origin}/track/${order.recovery_token}` : null);

    function handleCopyLink() {
        if (trackingUrl) {
            navigator.clipboard.writeText(trackingUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    function handleShare() {
        if (!trackingUrl) {
return;
}

        const text = `Lacak pesanan Dombi saya:\n${trackingUrl}`;

        if (navigator.share) {
            navigator.share({ text }).catch(() => {});
        } else {
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(whatsappUrl, '_blank');
        }
    }

    function handleCancel() {
        cancelForm.post(`/customer/orders/${order.id}/cancel`, {
            onSuccess: () => setShowCancelSheet(false),
        });
    }

    return (
        <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
            <OfflineBanner />

            {/* Sticky Header */}
            <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link href="/customer/orders" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div className="text-center">
                        <div className="text-sm font-semibold text-slate-900">{order.order_code}</div>
                        {order.ordered_at && (
                            <div className="text-[11px] text-slate-500">{formatDate(order.ordered_at)}</div>
                        )}
                    </div>
                    <div className="h-10 w-10" />
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-lg px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
                <Head title={order.order_code} />

                {/* Status Badge */}
                <div className="flex items-center justify-center">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${orderStatusTone[order.status] ?? 'bg-slate-50 text-slate-800 ring-slate-200'}`}>
                        {orderStatusLabel(order.status)}
                    </span>
                </div>

                {/* Tracking Code */}
                {order.recovery_token && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kode Pelacakan</div>
                        <div className="mt-2 flex items-center gap-3">
                            <div className="flex-1">
                                <div className="text-lg font-bold tabular-nums tracking-wider text-slate-900">{order.recovery_token}</div>
                                <div className="mt-0.5 text-[11px] text-slate-500">Gunakan link publik ini untuk melacak pesanan tanpa login</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyLink}
                                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                            >
                                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Tersalin' : 'Salin Link'}
                            </button>
                        </div>
                        {trackingUrl && (
                            <>
                                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold tabular-nums text-slate-700 break-all">
                                    {trackingUrl}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white active:bg-emerald-700"
                                >
                                    <Share2 className="h-4 w-4" />
                                    Bagikan Link Pelacakan
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Timeline */}
                <div className="mt-4">
                    <OrderTimeline
                        currentStatus={order.status}
                        histories={order.status_histories}
                        fulfillmentType={order.fulfillment_type}
                    />
                </div>

                {/* Rejection Reason */}
                {order.status === 'rejected_by_outlet' && order.rejection_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">Pesanan Ditolak Outlet</div>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.rejection_reason}</div>
                        {order.rejection_note && (
                            <div className="mt-1 text-xs text-red-700">{order.rejection_note}</div>
                        )}
                    </div>
                )}

                {/* Cancellation Reason */}
                {order.status === 'cancelled_by_customer' && order.cancellation_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">Pesanan Dibatalkan</div>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.cancellation_reason}</div>
                        {order.cancellation_note && (
                            <div className="mt-1 text-xs text-red-700">{order.cancellation_note}</div>
                        )}
                    </div>
                )}

                {/* Expired Reason */}
                {isExpired && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-slate-500" />
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Pesanan Kadaluarsa</div>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">Outlet tidak memberikan konfirmasi dalam batas waktu yang ditentukan.</div>
                    </div>
                )}

                {/* Courier Card */}
                {order.delivery?.courier && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Kurir</div>
                        <div className="mt-2 flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                <Truck className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="text-sm font-semibold text-slate-900">{order.delivery.courier.name}</div>
                        </div>
                    </div>
                )}

                {/* Failed Delivery Reason */}
                {order.delivery?.failed_reason && (
                    <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-red-600">Alasan gagal</div>
                        <div className="mt-1 text-sm text-red-800">{order.delivery.failed_reason}</div>
                    </div>
                )}

                {/* Delivery Address */}
                {order.fulfillment_type !== 'pickup' && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Alamat Pengiriman</div>
                        <div className="mt-2 text-sm font-medium text-slate-900">{order.customer_name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{order.customer_phone}</div>
                        <div className="mt-1.5 text-xs leading-relaxed text-slate-600">{order.customer_address}</div>
                        {order.customer_address_detail && (
                            <div className="mt-1 text-xs text-slate-600"><span className="font-medium text-slate-500">Detail: </span>{order.customer_address_detail}</div>
                        )}
                        {order.customer_landmark && (
                            <div className="mt-1 text-xs text-slate-600"><span className="font-medium text-slate-500">Patokan: </span>{order.customer_landmark}</div>
                        )}
                        {order.latitude && order.longitude && (
                            <a
                                href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 active:bg-emerald-100"
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                Buka di Maps
                            </a>
                        )}
                    </div>
                )}

                {/* Cancel Button */}
                {isPending && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => setShowCancelSheet(true)}
                            className="flex h-11 w-full items-center justify-center rounded-xl border border-red-200 text-sm font-semibold text-red-600 active:bg-red-50"
                        >
                            Batalkan Pesanan
                        </button>
                    </div>
                )}

                {/* Order Summary */}
                <div className="mt-4">
                    <OrderSummaryCard
                        items={order.items}
                        subtotal={order.subtotal}
                        deliveryFee={order.delivery_fee}
                        total={order.total}
                    />
                </div>
            </main>

            {/* Sticky Bottom Actions */}
            <StickyOrderActions orderId={order.id} showReorder={isTerminal} />

            {/* Cancel Sheet */}
            {showCancelSheet && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40" onClick={() => setShowCancelSheet(false)}>
                    <div
                        className="flex w-full max-w-lg flex-col rounded-t-3xl bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-16px_40px_rgba(15,23,42,0.16)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />
                        <div className="mt-3 flex items-center justify-between">
                            <h2 className="text-[15px] font-semibold text-slate-900">Batalkan Pesanan</h2>
                            <button type="button" onClick={() => setShowCancelSheet(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 active:bg-slate-100">
                                <XCircle className="h-4 w-4" />
                            </button>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">Pilih alasan pembatalan.</p>

                        <div className="mt-4 space-y-2">
                            {cancellationReasons.map((reason: string) => (
                                <button
                                    key={reason}
                                    type="button"
                                    onClick={() => cancelForm.setData('reason', reason)}
                                    className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${
                                        cancelForm.data.reason === reason
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                            : 'border-slate-200 text-slate-700 active:bg-slate-50'
                                    }`}
                                >
                                    {reason}
                                </button>
                            ))}
                        </div>

                        {cancelForm.data.reason === 'Lainnya' && (
                            <div className="mt-3">
                                <textarea
                                    value={cancelForm.data.note}
                                    onChange={(e) => cancelForm.setData('note', e.target.value)}
                                    placeholder="Jelaskan alasan pembatalan..."
                                    className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                />
                            </div>
                        )}

                        {cancelForm.errors.reason && (
                            <p className="mt-2 text-xs text-red-600">{cancelForm.errors.reason}</p>
                        )}
                        {cancelForm.errors.note && (
                            <p className="mt-1 text-xs text-red-600">{cancelForm.errors.note}</p>
                        )}

                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={!cancelForm.data.reason || cancelForm.processing}
                            className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white active:bg-red-700 disabled:bg-slate-300"
                        >
                            {cancelForm.processing ? 'Membatalkan...' : 'Batalkan Pesanan'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
