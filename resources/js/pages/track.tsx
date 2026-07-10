import { Head, Link, router, usePage } from '@inertiajs/react';
import { CheckCircle2, ChevronLeft, Clock, MapPin, MessageCircle, Navigation, Package, Phone, RotateCcw, Share2, Store, XCircle, AlertTriangle, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import OrderQRCard from '@/components/customer/order-qr-card';
import OrderTimeline from '@/components/customer/order-timeline';
import OfflineBanner from '@/components/shared/offline-banner';
import Dialog from '@/components/ui/dialog';
import StatusBadge from '@/components/ui/status-badge';
import { useCountdown } from '@/hooks/use-countdown';
import { formatCurrency, formatDate } from '@/lib/format';

type TrackOrder = {
    id: number;
    order_code: string;
    recovery_token: string;
    tracking_url: string;
    status: string;
    fulfillment_type: string;
    total: number;
    subtotal: number;
    delivery_fee: number;
    payment_method: string;
    confirmation_expires_at?: string | null;
    payment_status?: string | null;
    ordered_at?: string;
    outlet?: { name: string; address?: string; phone?: string; operating_hours?: string; latitude?: number; longitude?: number };
    items: { product_name: string; quantity: number; price: number; subtotal: number }[];
    status_histories: { to_status: string; notes?: string | null; created_at?: string | null }[];
    delivery?: { courier?: { name: string; phone?: string }; failed_reason?: string | null };
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    customer_address_detail?: string;
    customer_landmark?: string;
    rejection_reason?: string;
    rejection_note?: string;
    cancellation_reason?: string;
    cancellation_note?: string;
};

type Props = {
    order: TrackOrder | null;
    found: boolean;
    cancellationReasons?: string[];
    notifications?: { id: number; title: string; message: string; time_ago: string }[];
    canCancel?: boolean;
    canCreateAccount?: boolean;
    accountPhone?: string;
    accountName?: string;
};

const CANCELLABLE_STATUSES = ['pending_confirmation', 'confirmed', 'preparing'];

const STATUS_GUIDANCE: Record<string, { description: string; nextStep?: string; cta?: { label: string; href?: string; action?: string } }> = {
    pending_confirmation: {
        description: 'Menunggu outlet mengkonfirmasi pesanan Anda',
        nextStep: 'Biasanya dikonfirmasi dalam beberapa menit',
    },
    // Payment not yet completed — shown when payment_status is pending/null
    pending_confirmation_unpaid: {
        description: 'Menunggu Pembayaran',
        nextStep: 'Selesaikan pembayaran untuk melanjutkan pesanan',
    },
    // Payment failed but order still active — customer can retry
    pending_confirmation_payment_failed: {
        description: 'Pembayaran Gagal',
        nextStep: 'Pembayaran sebelumnya gagal. Anda masih bisa coba bayar ulang sebelum waktu habis.',
    },
    confirmed: {
        description: 'Pesanan sudah dikonfirmasi oleh outlet',
        nextStep: 'Outlet sedang menyiapkan pesanan Anda',
    },
    preparing: {
        description: 'Pesanan sedang disiapkan',
        nextStep: 'Pesanan akan segera siap',
    },
    ready_for_pickup: {
        description: 'Pesanan sudah siap diambil!',
        nextStep: 'Silakan ambil di outlet sebelum jam tutup',
        cta: { label: 'Navigasi ke Outlet', action: 'navigate' },
    },
    ready_for_pickup_delivery: {
        description: 'Pesanan sudah siap, menunggu kurir',
        nextStep: 'Kurir akan segera menjemput dan mengantar ke alamat Anda',
    },
    completed: {
        description: 'Pesanan telah selesai',
        nextStep: 'Terima kasih sudah pesan di Dombi!',
    },
    rejected_by_outlet: {
        description: 'Outlet tidak dapat memproses pesanan',
        nextStep: 'Silakan coba pesan dari outlet lain',
    },
    cancelled_by_customer: {
        description: 'Pesanan telah Anda batalkan',
    },
    cancelled_by_outlet: {
        description: 'Pesanan dibatalkan oleh outlet',
        nextStep: 'Silakan coba pesan lagi',
    },
    failed_delivery: {
        description: 'Pengiriman gagal',
        nextStep: 'Silakan hubungi kami untuk bantuan',
        cta: { label: 'Hubungi WhatsApp', action: 'wa_outlet' },
    },
    expired: {
        description: 'Pesanan kadaluarsa',
        nextStep: 'Outlet tidak konfirmasi dalam batas waktu',
    },
};

export default function TrackPage({ order, found, cancellationReasons = [], canCancel = false, canCreateAccount = false, accountPhone, accountName }: Props) {
    const { auth } = usePage().props as any;
    const isLoggedIn = !!auth?.user;
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelNote, setCancelNote] = useState('');
    const [cancelLast4Hp, setCancelLast4Hp] = useState('');
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const countdown = useCountdown(order?.confirmation_expires_at);

    // Auto-polling for non-terminal orders
    const isTerminal = ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'expired'].includes(order?.status ?? '');
    useEffect(() => {
        if (isTerminal || !order) return;
        const interval = setInterval(() => {
            router.reload({ only: ['order'] });
        }, 15000);
        return () => clearInterval(interval);
    }, [isTerminal, order?.id]);

    if (!found || !order) {
        return <NotFoundState />;
    }

    const isPickup = order.fulfillment_type === 'pickup';
    const isCancellable = CANCELLABLE_STATUSES.includes(order.status);
    const trackingUrl = order.tracking_url;

    function handleShare() {
        const text = `Lacak pesanan Dombi saya:\n${trackingUrl}`;

        if (navigator.share) {
            navigator.share({ text }).catch(() => {});
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }
    }

    async function handleCancel() {
        if (!cancelReason) {
return;
}

        setCancelLoading(true);
        setCancelError(null);

        try {
            const url = `/track/${order.recovery_token}/cancel`;

            const response = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({
                    reason: cancelReason,
                    note: cancelNote || null,
                    ...(isPickup && { last4_hp: cancelLast4Hp }),
                }),
            });

            const data = await response.json();

            if (data.success) {
                setCancelDialogOpen(false);
                window.location.reload();
            } else {
                setCancelError(data.error || 'Gagal membatalkan pesanan.');
            }
        } catch {
            setCancelError('Gagal membatalkan pesanan. Periksa koneksi Anda.');
        } finally {
            setCancelLoading(false);
        }
    }

    return (
        <div className="min-h-dvh bg-surface">
            <Head title={`Pesanan ${order.order_code}`} />
            <OfflineBanner />

            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur pt-safe">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <button
                        type="button"
                        onClick={() => router.visit(isLoggedIn ? '/customer/orders' : '/customer/home')}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
                        aria-label="Kembali"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="text-center">
                        <div className="text-sm font-semibold text-text">{order.order_code}</div>
                        {order.ordered_at && (
                            <div className="text-[11px] text-text-muted">{formatDate(order.ordered_at)}</div>
                        )}
                    </div>
                    <div className="h-11 w-11" />
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-lg px-4 pt-4 pb-24">

                {/* Status Badge */}
                <div className="flex items-center justify-center">
                    {order.status === 'ready_for_pickup' && !isPickup ? (
                        <StatusBadge variant="info">Menunggu Kurir</StatusBadge>
                    ) : (
                        <StatusBadge status={order.status === 'pending_confirmation' && order.payment_status !== 'paid' ? (order.payment_status === 'failed' || order.payment_status === 'expired' ? 'payment_failed' : 'pending_payment') : order.status} />
                    )}
                </div>

                {/* Payment Issue Banner */}
                {order.status === 'pending_confirmation' && (order.payment_status === 'failed' || order.payment_status === 'expired') && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                            <div>
                                <div className="text-sm font-semibold text-red-800">
                                    {order.payment_status === 'failed' ? 'Pembayaran Gagal' : 'Pembayaran Kadaluarsa'}
                                </div>
                                <div className="mt-1 text-xs text-red-600">
                                    {order.payment_status === 'failed'
                                        ? 'Pembayaran tidak berhasil diproses. Silakan coba bayar ulang.'
                                        : 'Batas waktu pembayaran telah habis. Silakan coba bayar ulang.'}
                                </div>
                                <Link
                                    href={`/customer/orders/confirm/${order.order_code}`}
                                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-bold text-white active:opacity-80"
                                >
                                    Bayar Ulang
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* What's Next Guidance */}
                {(() => {
                    // Determine the effective guidance key:
                    // For pending_confirmation with unpaid, show payment guidance
                    const isPendingUnpaid = order.status === 'pending_confirmation'
                        && order.payment_status !== 'paid';
                    const isPaymentFailed = order.payment_status === 'failed' || order.payment_status === 'expired';
                    const isDelivery = order.fulfillment_type !== 'pickup';
                    const guidanceKey = isPendingUnpaid
                        ? (isPaymentFailed ? 'pending_confirmation_payment_failed' : 'pending_confirmation_unpaid')
                        : (order.status === 'ready_for_pickup' && isDelivery ? 'ready_for_pickup_delivery' : order.status);
                    const guidance = STATUS_GUIDANCE[guidanceKey];

                    if (!guidance) {
return null;
}

                    const isPickupReady = order.status === 'ready_for_pickup' && order.outlet?.latitude && order.outlet?.longitude;
                    const showCountdown = order.status === 'pending_confirmation' && !isPendingUnpaid && !countdown.expired && countdown.totalSeconds > 0;

                    return (
                        <div className="mt-3 rounded-xl border border-border bg-white p-4">
                            <div className="text-sm font-semibold text-text">{guidance.description}</div>
                            {showCountdown && (
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5">
                                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                                        <span className="text-sm font-bold tabular-nums text-amber-700">
                                            {String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                                        </span>
                                    </div>
                                    <span className="text-xs text-text-subtle">sisa waktu konfirmasi</span>
                                </div>
                            )}
                            {guidance.nextStep && (
                                <div className="mt-1 text-xs text-text-muted">{guidance.nextStep}</div>
                            )}
                            {guidance.cta && (
                                <div className="mt-3">
                                    {isPickupReady && guidance.cta.action === 'navigate' ? (
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${order.outlet!.latitude},${order.outlet!.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white active:opacity-80"
                                        >
                                            <MapPin className="h-4 w-4" />
                                            {guidance.cta.label}
                                        </a>
                                    ) : guidance.cta.action === 'wa_outlet' && order.outlet?.phone ? (
                                        <a
                                            href={`https://wa.me/${order.outlet.phone.replace(/^0/, '62')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white active:opacity-80"
                                        >
                                            <Phone className="h-4 w-4" />
                                            {guidance.cta.label}
                                        </a>
                                    ) : guidance.cta.href ? (
                                        <Link
                                            href={guidance.cta.href}
                                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white active:opacity-80"
                                        >
                                            {guidance.cta.label}
                                        </Link>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* QR Code — promoted above fold for pickup ready_for_pickup */}
                {isPickup && order.status === 'ready_for_pickup' && (
                    <OrderQRCard orderCode={order.order_code} />
                )}

                {/* Completed Hero */}
                {order.status === 'completed' && (
                    <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 p-6 text-center">
                        <div className="flex justify-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                            </div>
                        </div>
                        <h2 className="mt-4 text-lg font-bold text-text">Pesanan Selesai!</h2>
                        <p className="mt-1 text-sm text-text-muted">Terima kasih sudah pesan di Dombi 🎉</p>
                    </div>
                )}

                {/* Share Tracking — hidden when completed */}
                {!isTerminal && trackingUrl && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={handleShare}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80"
                        >
                            <Share2 className="h-4 w-4" />
                            Kirim Lacak Pesanan ke WhatsApp
                        </button>
                    </div>
                )}

                {/* Timeline — collapsible */}
                <div className="mt-4">
                    <OrderTimeline
                        currentStatus={order.status}
                        histories={order.status_histories}
                        fulfillmentType={order.fulfillment_type}
                        defaultCollapsed
                    />
                </div>

                {/* Order Items */}
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-muted">
                            <Package className="h-3.5 w-3.5 text-text-muted" />
                        </div>
                        <span className="text-[13px] text-text-subtle">Item Pesanan</span>
                    </div>
                    <div className="space-y-2">
                        {order.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                                <div className="min-w-0">
                                    <span className="text-text">{item.product_name}</span>
                                    <span className="ml-1 text-xs text-text-subtle">x{item.quantity}</span>
                                </div>
                                <span className="shrink-0 font-semibold tabular-nums text-text">{formatCurrency(item.subtotal)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 border-t border-border pt-3 space-y-1">
                        <div className="flex items-center justify-between text-xs text-text-muted">
                            <span>Subtotal</span>
                            <span>{formatCurrency(order.subtotal)}</span>
                        </div>
                        {order.delivery_fee > 0 && (
                            <div className="flex items-center justify-between text-xs text-text-muted">
                                <span>Ongkir</span>
                                <span>{formatCurrency(order.delivery_fee)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between text-sm font-semibold text-text pt-1">
                            <span>Total</span>
                            <span className="tabular-nums">{formatCurrency(order.total)}</span>
                        </div>
                    </div>
                </div>

                {/* Order Info */}
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-text-muted">Metode</span>
                            <span className="font-medium text-text">{isPickup ? 'Ambil di Outlet' : 'Kirim ke Alamat'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Pembayaran</span>
                            <span className="font-medium text-text">{order.payment_method}</span>
                        </div>
                        {order.ordered_at && (
                            <div className="flex justify-between">
                                <span className="text-text-muted">Tanggal</span>
                                <span className="font-medium text-text">{formatDate(order.ordered_at)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Outlet */}
                {order.outlet && (
                    <div className="mt-4 rounded-xl border border-border bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <Store className="h-4 w-4 text-text-subtle" />
                                    <span className="text-sm font-semibold text-text">{order.outlet.name}</span>
                                </div>
                                {order.outlet.address && (
                                    <div className="mt-1 text-xs text-text-muted">{order.outlet.address}</div>
                                )}
                            </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                            {order.outlet.latitude && order.outlet.longitude && (
                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${order.outlet.latitude},${order.outlet.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-1 min-h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white active:opacity-80"
                                >
                                    <Navigation className="h-4 w-4" />
                                    Navigasi
                                </a>
                            )}
                            {order.outlet.phone && (
                                <a
                                    href={`https://wa.me/${order.outlet.phone.replace(/^0/, '62')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-1 min-h-11 items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold text-text active:opacity-80"
                                >
                                    <Phone className="h-4 w-4" />
                                    WhatsApp
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Delivery Address */}
                {!isPickup && order.customer_address && (
                    <div className="mt-4 rounded-xl border border-border bg-white p-4">
                        <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-subtle" />
                            <div className="min-w-0 flex-1">
                                <div className="line-clamp-2 text-sm font-medium text-text">{order.customer_address}</div>
                                {order.customer_address_detail && (
                                    <div className="mt-0.5 text-xs text-text-muted">{order.customer_address_detail}</div>
                                )}
                                {order.customer_landmark && (
                                    <div className="mt-1 flex items-center gap-1 text-xs text-text-subtle">
                                        <MapPin className="h-3 w-3" />
                                        {order.customer_landmark}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Courier */}
                {order.delivery?.courier && (
                    <div className="mt-4 rounded-xl border border-border bg-white p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
                                <UserCheck className="h-5 w-5 text-text-muted" />
                            </div>
                            <div>
                                <div className="text-[11px] text-text-subtle">Kurir</div>
                                <div className="text-sm font-semibold text-text">{order.delivery.courier.name}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rejection / Cancellation */}
                {order.status === 'rejected_by_outlet' && order.rejection_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <div className="text-[13px] text-red-600">Pesanan Ditolak Outlet</div>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.rejection_reason}</div>
                        {order.rejection_note && <div className="mt-1 text-xs text-red-700">{order.rejection_note}</div>}
                    </div>
                )}

                {order.status === 'cancelled_by_customer' && order.cancellation_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <div className="text-[13px] text-red-600">Pesanan Dibatalkan</div>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.cancellation_reason}</div>
                        {order.cancellation_note && <div className="mt-1 text-xs text-red-700">{order.cancellation_note}</div>}
                    </div>
                )}

                {order.status === 'cancelled_by_outlet' && order.cancellation_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <div className="text-[13px] text-red-600">Dibatalkan Outlet</div>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.cancellation_reason}</div>
                    </div>
                )}

                {order.status === 'failed_delivery' && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <div className="text-[13px] text-amber-700">Pengiriman Gagal</div>
                        </div>
                        {order.delivery?.failed_reason && (
                            <div className="mt-1.5 text-sm font-medium text-amber-900">{order.delivery.failed_reason}</div>
                        )}
                        <div className="mt-2 text-sm text-amber-800">Silakan hubungi outlet untuk bantuan.</div>
                        {order.outlet?.phone && (
                            <a
                                href={`https://wa.me/${order.outlet.phone.replace(/^0/, '62')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white active:opacity-80"
                            >
                                <Phone className="h-4 w-4" />
                                Hubungi WhatsApp
                            </a>
                        )}
                    </div>
                )}

                {order.status === 'expired' && (
                    <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-text-muted" />
                            <div className="text-[13px] text-text">Pesanan Kadaluarsa</div>
                        </div>
                        <div className="mt-2 text-sm text-text-muted">Outlet tidak memberikan konfirmasi dalam batas waktu.</div>
                        <Link
                            href="/customer/home"
                            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white active:opacity-80"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Pesan Ulang
                        </Link>
                    </div>
                )}

                {/* Pay Now / Retry Button — unpaid pending orders (including failed payment) */}
                {order.status === 'pending_confirmation'
                    && order.payment_status !== 'paid' && (
                    <div className="mt-4">
                        <Link
                            href={`/customer/orders/confirm/${order.order_code}`}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80"
                        >
                            {order.payment_status === 'failed' || order.payment_status === 'expired' ? 'Bayar Ulang' : 'Bayar Sekarang'}
                        </Link>
                        <p className="mt-2 text-center text-[11px] text-text-subtle">
                            {order.payment_status === 'failed' || order.payment_status === 'expired'
                                ? 'Pembayaran sebelumnya gagal. Coba bayar ulang.'
                                : 'Selesaikan pembayaran untuk melanjutkan pesanan'}
                        </p>
                    </div>
                )}

                {/* Cancel Button — authenticated users */}
                {isCancellable && canCancel && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => setCancelDialogOpen(true)}
                            className="flex h-11 w-full items-center justify-center rounded-xl border border-red-200 text-sm font-semibold text-red-600 active:opacity-80"
                        >
                            Batalkan Pesanan
                        </button>
                        <p className="mt-2 text-center text-[11px] text-text-subtle">
                            Batalkan hanya jika pesanan belum diproses
                        </p>
                    </div>
                )}

                {/* Login CTA for cancel — guest users */}
                {isCancellable && !canCancel && !isLoggedIn && (
                    <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-center">
                        <div className="text-sm font-medium text-text">Ingin membatalkan pesanan?</div>
                        <div className="mt-1 text-xs text-text-muted">Masuk atau buat akun untuk mengelola pesanan Anda.</div>
                        <a
                            href={`/oauth/google?redirect=${encodeURIComponent(`/track/${order.recovery_token}`)}`}
                            className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-white active:opacity-80"
                        >
                            Masuk dengan Google
                        </a>
                    </div>
                )}

                {/* Verify phone prompt — authenticated but phone not linked */}
                {isCancellable && !canCancel && isLoggedIn && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-start gap-3">
                            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                            <div className="flex-1 space-y-2">
                                <div>
                                    <h3 className="text-sm font-medium text-amber-900">Verifikasi HP untuk kelola pesanan</h3>
                                    <p className="text-xs text-amber-700">
                                        Verifikasi nomor HP Anda untuk dapat membatalkan dan mengelola pesanan ini.
                                    </p>
                                </div>
                                <a
                                    href="/customer/verify-phone"
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                                >
                                    Verifikasi Sekarang
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* Non-cancellable message */}
                {!isCancellable && !isTerminal && (
                    <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-center">
                        <div className="text-sm text-text-muted">
                            Pesanan sedang diproses dan tidak dapat dibatalkan.
                        </div>
                        {order.outlet?.phone && (
                            <a
                                href={`https://wa.me/${order.outlet.phone.replace(/^0/, '62')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary active:opacity-80"
                            >
                                <Phone className="h-3.5 w-3.5" />
                                WhatsApp Outlet
                            </a>
                        )}
                    </div>
                )}

                {/* Account Promotion */}
                {canCreateAccount && accountPhone && (
                    <AccountPromotionBanner phone={accountPhone} name={accountName} />
                )}

                {/* Branding */}
                <div className="mt-8 text-center">
                    <p className="text-[11px] text-text-subtle">Powered by</p>
                    <p className="text-sm font-bold text-text-muted">Dombi</p>
                </div>
            </main>

            {/* Cancel Dialog */}
            <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} title="Batalkan Pesanan">
                <p className="text-sm text-text-muted">Pesanan yang dibatalkan tidak dapat dipulihkan.</p>

                {isPickup && (
                    <div className="mt-4">
                        <label className="text-xs font-medium text-text-subtle">4 digit terakhir nomor HP</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="\d{4}"
                            maxLength={4}
                            value={cancelLast4Hp}
                            onChange={(e) => setCancelLast4Hp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="Contoh: 1234"
                            className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm text-text tabular-nums placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                        <p className="mt-1 text-[11px] text-text-subtle">Untuk keamanan pembatalan pesanan pickup</p>
                    </div>
                )}

                <div className="mt-4 space-y-2">
                    {cancellationReasons.map((reason: string) => (
                        <button
                            key={reason}
                            type="button"
                            onClick={() => setCancelReason(reason)}
                            className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${
                                cancelReason === reason
                                    ? 'border-primary bg-primary-light text-primary'
                                    : 'border-border text-text active:opacity-80'
                            }`}
                        >
                            {reason}
                        </button>
                    ))}
                </div>

                {cancelReason === 'Lainnya' && (
                    <div className="mt-3">
                        <textarea
                            value={cancelNote}
                            onChange={(e) => setCancelNote(e.target.value)}
                            placeholder="Jelaskan alasan pembatalan..."
                            className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                    </div>
                )}

                {cancelError && <p className="mt-2 text-sm font-medium text-red-600">{cancelError}</p>}

                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setCancelDialogOpen(false);
                            setCancelLast4Hp('');
                            setCancelError(null);
                        }}
                        className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                    >
                        Kembali
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={!cancelReason || cancelLoading || (isPickup && cancelLast4Hp.length !== 4)}
                        className="flex h-12 flex-1 items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle"
                    >
                        {cancelLoading ? 'Membatalkan...' : 'Ya, Batalkan'}
                    </button>
                </div>
            </Dialog>
        </div>
    );
}

function NotFoundState() {
    return (
        <div className="min-h-dvh bg-surface">
            <Head title="Pesanan Tidak Ditemukan" />
            <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-muted">
                    <XCircle className="h-8 w-8 text-text-subtle" />
                </div>
                <h1 className="mt-4 text-lg font-semibold text-text">Pesanan Tidak Ditemukan</h1>
                <p className="mt-2 text-sm text-text-muted">Kode pelacakan tidak valid atau pesanan sudah tidak tersedia.</p>
                <a href="/customer/home" className="mt-6 flex min-h-11 items-center rounded-xl bg-primary px-6 text-sm font-bold text-white active:opacity-80">
                    Kembali ke Beranda
                </a>
            </div>
        </div>
    );
}

function AccountPromotionBanner({ phone, name }: { phone: string; name?: string }) {
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState(name ?? '');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const maskedPhone = phone.replace(/(\d{2})\d+(\d{4})/, '$1••••$2');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await fetch('/customer/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({ phone, name: formName, password, password_confirmation: passwordConfirmation }),
            });

            const data = await response.json();

            if (data.success) {
                window.location.href = data.redirect;
            } else {
                setError(data.error ?? 'Gagal membuat akun.');
            }
        } catch {
            setError('Gagal membuat akun. Periksa koneksi Anda.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[13px] text-emerald-600">Buat Akun</div>
            <div className="mt-2 text-sm text-emerald-800">
                Buat akun untuk melacak pesanan, menyimpan alamat, dan memesan lebih mudah.
            </div>

            {!showForm ? (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80"
                >
                    Buat Akun Sekarang
                </button>
            ) : (
                <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Nomor HP (terverifikasi)</label>
                        <div className="mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-text">{maskedPhone}</div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Nama</label>
                        <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            required
                            minLength={3}
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-text focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-text focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Konfirmasi Password</label>
                        <input
                            type="password"
                            value={passwordConfirmation}
                            onChange={(e) => setPasswordConfirmation(e.target.value)}
                            required
                            minLength={8}
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-text focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>

                    {error && <p className="text-sm font-medium text-red-600">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                    >
                        {loading ? 'Membuat Akun...' : 'Daftar'}
                    </button>
                </form>
            )}
        </div>
    );
}
