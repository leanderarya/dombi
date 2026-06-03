import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, MapPin, Share2, Truck } from 'lucide-react';
import OrderSummaryCard from '@/components/customer/order-summary-card';
import OrderTimeline from '@/components/customer/order-timeline';
import StickyOrderActions from '@/components/customer/sticky-order-actions';
import OfflineBanner from '@/components/offline-banner';
import { orderStatusLabel, orderStatusTone, activeOrderStatuses } from '@/lib/customer-status';
import { useOrderRecovery } from '@/lib/order-recovery';
import { formatDate } from '@/lib/format';

export default function OrderShow({ order }: any) {
    const isActive = activeOrderStatuses.includes(order.status);
    const isTerminal = ['completed', 'cancelled', 'failed'].includes(order.status);
    const { addOrder } = useOrderRecovery();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (order.customer_phone && order.order_code) {
            addOrder(order.customer_phone, order.order_code);
        }
    }, [order.customer_phone, order.order_code, addOrder]);

    const trackingUrl = order.recovery_token
        ? `${window.location.origin}/track/${order.recovery_token}`
        : null;

    function handleCopyToken() {
        if (order.recovery_token) {
            navigator.clipboard.writeText(order.recovery_token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    function handleShare() {
        if (!trackingUrl) return;

        const text = `Lacak pesanan Dombi saya:\n${trackingUrl}`;

        if (navigator.share) {
            navigator.share({ text }).catch(() => {});
        } else {
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(whatsappUrl, '_blank');
        }
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
                                <div className="mt-0.5 text-[11px] text-slate-500">Gunakan kode ini untuk melacak pesanan</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyToken}
                                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                            >
                                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Tersalin' : 'Salin'}
                            </button>
                        </div>
                        {trackingUrl && (
                            <button
                                type="button"
                                onClick={handleShare}
                                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white active:bg-emerald-700"
                            >
                                <Share2 className="h-4 w-4" />
                                Bagikan Link Pelacakan
                            </button>
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
        </div>
    );
}
