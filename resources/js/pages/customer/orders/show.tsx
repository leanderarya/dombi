import { Head, Link, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Copy, MapPin, Navigation, Phone, Share2, Store, Truck, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import OrderSummaryCard from '@/components/customer/order-summary-card';
import OrderTimeline from '@/components/customer/order-timeline';
import StickyOrderActions from '@/components/customer/sticky-order-actions';
import OfflineBanner from '@/components/offline-banner';
import Dialog from '@/components/ui/dialog';
import { orderStatusLabel, orderStatusTone, activeOrderStatuses } from '@/lib/customer-status';
import { formatDate } from '@/lib/format';
import { useOrderRecovery } from '@/lib/order-recovery';

export default function OrderShow({ order, cancellationReasons = [], isConfirmation = false }: any) {
    const isActive = activeOrderStatuses.includes(order.status);
    const isTerminal = ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'].includes(order.status);
    const isPending = order.status === 'pending_confirmation';
    const isExpired = order.status === 'expired';
    const { addOrder } = useOrderRecovery();
    const [copied, setCopied] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

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
            onSuccess: () => setCancelDialogOpen(false),
        });
    }

    return (
        <div className="min-h-dvh bg-surface text-text">
            <OfflineBanner />

            {/* Sticky Header */}
            <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <Link href="/customer/orders" className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <div className="text-center">
                        <div className="text-sm font-semibold text-text">{order.order_code}</div>
                        {order.ordered_at && (
                            <div className="text-[11px] text-text-muted">{formatDate(order.ordered_at)}</div>
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
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${orderStatusTone[order.status] ?? 'bg-surface-muted text-text ring-border'}`}>
                        {orderStatusLabel(order.status)}
                    </span>
                </div>

                {/* Order Success Banner — shown immediately after checkout */}
                {(isConfirmation || isPending) && order.recovery_token && (
                    <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <div className="text-lg font-bold text-emerald-900">Pesanan Berhasil!</div>
                                <div className="text-sm text-emerald-700">Simpan kode di bawah untuk melacak pesanan</div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white border border-emerald-200 p-4">
                            <div className="text-[13px] text-emerald-700 mb-1">Kode Pelacakan Anda</div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="text-2xl font-bold tabular-nums tracking-wider text-emerald-900">{order.recovery_token}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className="flex h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white active:opacity-80"
                                >
                                    {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    {copied ? 'Tersalin' : 'Salin'}
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 text-xs text-emerald-600 leading-relaxed">
                            <span className="font-semibold">Penting:</span> Kode ini dibutuhkan untuk melacak pesanan tanpa login. Kirim ke diri sendiri atau simpan di tempat aman.
                        </div>

                        {trackingUrl && (
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80"
                                >
                                    <Share2 className="h-4 w-4" />
                                    Kirim Kode ke WhatsApp
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Pickup Info Card */}
                {order.fulfillment_type === 'pickup' && order.outlet && (
                    <div className="mt-4 rounded-2xl border border-border bg-white p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50">
                                <Store className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                            <span className="text-[13px] text-text-subtle">Ambil di Outlet</span>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                                <Store className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-semibold text-text">{order.outlet.name}</div>
                                {order.outlet.address && (
                                    <div className="mt-0.5 text-xs text-text-muted">{order.outlet.address}</div>
                                )}
                            </div>
                        </div>

                        {/* QR Code when ready_for_pickup */}
                        {order.status === 'ready_for_pickup' && (
                            <div className="mt-4 rounded-xl bg-surface-muted p-4 flex flex-col items-center">
                                <QRCodeSVG
                                    value={order.order_code}
                                    size={180}
                                    bgColor="#f4f4f5"
                                    fgColor="#1e40af"
                                    level="M"
                                    marginSize={0}
                                />
                                <div className="mt-2 text-center">
                                    <div className="text-sm font-bold tracking-wider text-blue-700">{order.order_code}</div>
                                    <div className="mt-1 text-[11px] text-text-subtle">Tunjukkan QR ini ke kasir</div>
                                </div>
                            </div>
                        )}

                        {/* Navigation Button */}
                        {order.outlet.latitude && order.outlet.longitude && (
                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${order.outlet.latitude},${order.outlet.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 min-h-[44px] text-sm font-bold text-white transition-all active:opacity-80"
                            >
                                <Navigation className="h-4 w-4" />
                                Navigasi ke Outlet
                            </a>
                        )}

                        {/* Pickup Instructions */}
                        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
                            <div className="text-xs font-semibold text-blue-800 mb-2">Cara Mengambil:</div>
                            <ol className="space-y-1.5 text-xs text-blue-700">
                                <li className="flex items-start gap-2">
                                    <span className="font-semibold text-blue-800">1.</span>
                                    <span>Datang ke outlet yang tertera di atas</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="font-semibold text-blue-800">2.</span>
                                    <span>Tunjukkan <span className="font-bold">QR code</span> di atas ke kasir</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="font-semibold text-blue-800">3.</span>
                                    <span>Ambil pesanan Anda</span>
                                </li>
                            </ol>
                        </div>

                        {/* Contact Outlet */}
                        {order.outlet.phone && (
                            <a
                                href={`tel:${order.outlet.phone}`}
                                className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 min-h-[44px] text-sm font-semibold text-blue-700 transition-all active:opacity-80"
                            >
                                <Phone className="h-4 w-4" />
                                Hubungi Outlet
                            </a>
                        )}
                    </div>
                )}

                {/* Tracking Code — only show if NOT already shown in confirmation banner */}
                {order.recovery_token && !(isConfirmation || isPending) && (
                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100">
                                <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                            <span className="text-[13px] font-semibold text-blue-900">Kode Pelacakan</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 rounded-lg bg-white px-3 py-2.5 border border-blue-200">
                                <div className="text-xl font-bold tabular-nums tracking-wider text-blue-900">{order.recovery_token}</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyLink}
                                className="flex h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white active:opacity-80"
                            >
                                {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Tersalin' : 'Salin'}
                            </button>
                        </div>
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
                            <div className="text-[13px] text-red-600">Pesanan Ditolak Outlet</div>
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
                            <div className="text-[13px] text-red-600">Pesanan Dibatalkan</div>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.cancellation_reason}</div>
                        {order.cancellation_note && (
                            <div className="mt-1 text-xs text-red-700">{order.cancellation_note}</div>
                        )}
                    </div>
                )}

                {/* Expired Reason */}
                {isExpired && (
                    <div className="mt-4 rounded-2xl border border-border bg-surface-muted p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-text-muted" />
                            <div className="text-[13px] text-text">Pesanan Kadaluarsa</div>
                        </div>
                        <div className="mt-2 text-sm text-text">Outlet tidak memberikan konfirmasi dalam batas waktu yang ditentukan.</div>
                    </div>
                )}

                {/* Courier Card */}
                {order.delivery?.courier && (
                    <div className="mt-4 rounded-2xl border border-border bg-white p-4">
                        <div className="text-[13px] text-text-subtle">Kurir</div>
                        <div className="mt-2 flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                <Truck className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="text-sm font-semibold text-text">{order.delivery.courier.name}</div>
                        </div>
                    </div>
                )}

                {/* Failed Delivery Reason */}
                {order.delivery?.failed_reason && (
                    <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-4">
                        <div className="text-[13px] text-red-600">Alasan gagal</div>
                        <div className="mt-1 text-sm text-red-800">{order.delivery.failed_reason}</div>
                    </div>
                )}

                {/* Delivery Address */}
                {order.fulfillment_type !== 'pickup' && (
                    <div className="mt-4 rounded-2xl border border-border bg-white p-4">
                        <div className="text-[13px] text-text-subtle">Alamat Pengiriman</div>
                        <div className="mt-2 text-sm font-medium text-text">{order.customer_name}</div>
                        <div className="mt-0.5 text-xs text-text-muted">{order.customer_phone}</div>
                        <div className="mt-1.5 text-xs leading-relaxed text-text">{order.customer_address}</div>
                        {order.customer_address_detail && (
                            <div className="mt-1 text-xs text-text"><span className="font-medium text-text-muted">Detail: </span>{order.customer_address_detail}</div>
                        )}
                        {order.customer_landmark && (
                            <div className="mt-1 text-xs text-text"><span className="font-medium text-text-muted">Patokan: </span>{order.customer_landmark}</div>
                        )}
                        {order.latitude && order.longitude && (
                            <a
                                href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 active:opacity-80"
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
                            onClick={() => setCancelDialogOpen(true)}
                            className="flex h-11 w-full items-center justify-center rounded-xl border border-red-200 text-sm font-semibold text-red-600 active:opacity-80"
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

            {/* Cancel Dialog */}
            <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} title="Batalkan Pesanan">
                <p className="text-sm text-text-muted">Pilih alasan pembatalan.</p>

                <div className="mt-4 space-y-2">
                    {cancellationReasons.map((reason: string) => (
                        <button
                            key={reason}
                            type="button"
                            onClick={() => cancelForm.setData('reason', reason)}
                            className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${
                                cancelForm.data.reason === reason
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                    : 'border-border text-text active:opacity-80'
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
                            className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
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
                    className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle"
                >
                    {cancelForm.processing ? 'Membatalkan...' : 'Batalkan Pesanan'}
                </button>
            </Dialog>
        </div>
    );
}
