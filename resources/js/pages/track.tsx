import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Clock, Copy, MapPin, MessageCircle, Package, Phone, RotateCcw, Share2, Store, Truck, UserCheck, XCircle, CheckCircle2, Circle, Navigation, ChevronRight, QrCode } from 'lucide-react';
import { useState } from 'react';
import OrderStatusBadge from '@/components/order-status-badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';

type HistoryItem = {
    to_status: string;
    notes?: string | null;
    created_at?: string | null;
};

type TrackOrder = {
    id: number;
    order_code: string;
    tracking_url: string;
    status: string;
    fulfillment_type: string;
    total: number;
    ordered_at?: string;
    outlet?: { name: string; address?: string; phone?: string };
    items: { product_name: string; quantity: number; subtotal: number }[];
    status_histories: HistoryItem[];
    delivery?: { courier?: { name: string; phone?: string } };
    customer_address?: string;
    rejection_reason?: string;
    rejection_note?: string;
    cancellation_reason?: string;
    cancellation_note?: string;
};

type Props = {
    order: TrackOrder | null;
    found: boolean;
    notifications?: { id: number; title: string; message: string; time_ago: string }[];
    canCreateAccount?: boolean;
    accountPhone?: string;
    accountName?: string;
};

const DELIVERY_STEPS = [
    { key: 'pending_confirmation', label: 'Pesanan Dibuat', icon: Clock, description: 'Menunggu konfirmasi outlet' },
    { key: 'confirmed', label: 'Dikonfirmasi Outlet', icon: CheckCircle2, description: 'Outlet menerima pesanan Anda' },
    { key: 'preparing', label: 'Sedang Disiapkan', icon: Package, description: 'Pesanan sedang disiapkan' },
    { key: 'ready_for_pickup', label: 'Siap Dikirim', icon: Package, description: 'Pesanan siap untuk kurir' },
    { key: 'picked_up', label: 'Kurir Mengambil', icon: UserCheck, description: 'Kurir sudah mengambil pesanan' },
    { key: 'delivering', label: 'Dalam Perjalanan', icon: Truck, description: 'Pesanan sedang diantar ke Anda' },
    { key: 'completed', label: 'Tiba di Tujuan', icon: CheckCircle2, description: 'Pesanan sudah diterima' },
];

const PICKUP_STEPS = [
    { key: 'pending_confirmation', label: 'Pesanan Dibuat', icon: Clock, description: 'Menunggu konfirmasi outlet' },
    { key: 'confirmed', label: 'Dikonfirmasi Outlet', icon: CheckCircle2, description: 'Outlet menerima pesanan Anda' },
    { key: 'preparing', label: 'Sedang Disiapkan', icon: Package, description: 'Pesanan sedang disiapkan' },
    { key: 'ready_for_pickup', label: 'Siap Diambil', icon: QrCode, description: 'Ambil di outlet sekarang' },
    { key: 'completed', label: 'Sudah Diambil', icon: CheckCircle2, description: 'Pesanan selesai' },
];

export default function TrackPage({ order, found, notifications = [], canCreateAccount = false, accountPhone, accountName }: Props) {
    const [copied, setCopied] = useState(false);

    if (!found || !order) {
        return (
            <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
                <Head title="Lacak Pesanan" />
                <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                        <XCircle className="h-8 w-8 text-slate-400" />
                    </div>
                    <h1 className="mt-4 text-lg font-semibold text-slate-900">Pesanan Tidak Ditemukan</h1>
                    <p className="mt-2 text-sm text-slate-500">Kode pelacakan tidak valid atau pesanan sudah tidak tersedia.</p>
                    <a href="/customer/home" className="mt-6 flex min-h-11 items-center rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white transition-colors active:bg-emerald-700">
                        Kembali ke Beranda
                    </a>
                </div>
            </div>
        );
    }

    const isPickup = order.fulfillment_type === 'pickup';
    const isCancelled = order.status === 'cancelled_by_customer' || order.status === 'cancelled_by_outlet';
    const isRejected = order.status === 'rejected_by_outlet';
    const isFailed = order.status === 'failed_delivery';
    const isExpired = order.status === 'expired';
    const isCompleted = order.status === 'completed';
    const isTerminal = isCompleted || isCancelled || isRejected || isFailed || isExpired;
    const isReadyForPickup = order.status === 'ready_for_pickup';

    const terminalLabel = isRejected
        ? 'Ditolak Outlet'
        : order.status === 'cancelled_by_customer'
            ? 'Dibatalkan'
            : order.status === 'cancelled_by_outlet'
                ? 'Dibatalkan Outlet'
                : isExpired
                    ? 'Kadaluarsa'
                    : 'Pengiriman Gagal';

    const terminalIcon = isRejected ? XCircle : isCancelled ? XCircle : isFailed ? Truck : Clock;

    const steps = isTerminal
        ? [DELIVERY_STEPS[0], { key: order.status, label: terminalLabel, icon: terminalIcon, description: '' }]
        : isPickup ? PICKUP_STEPS : DELIVERY_STEPS;

    const currentIndex = isTerminal ? 1 : steps.findIndex((s) => s.key === order.status);
    const effectiveIndex = currentIndex < 0 ? 0 : currentIndex;

    const historyMap = new Map<string, HistoryItem>();

    for (const h of order.status_histories) {
        if (!historyMap.has(h.to_status)) {
            historyMap.set(h.to_status, h);
        }
    }

    const trackingUrl = order.tracking_url;
    const shareText = `Lacak pesanan Dombi saya:\n${trackingUrl}`;

    function copyTrackingLink() {
        navigator.clipboard.writeText(trackingUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function shareTrackingLink() {
        if (navigator.share) {
            navigator.share({ text: shareText }).catch(() => {});
            return;
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    }

    function shareViaWhatsApp() {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    }

    return (
        <div className="min-h-dvh bg-[#fbf9f7]">
            <Head title={`Lacak ${order.order_code}`} />

            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <a href="/customer/home" className="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted transition-colors active:bg-surface-muted">
                        <ArrowLeft className="h-5 w-5" />
                    </a>
                    <div className="text-center">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-text">{order.order_code}</span>
                            <span className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                isPickup ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                            )}>
                                {isPickup ? 'Pickup' : 'Delivery'}
                            </span>
                        </div>
                        {order.ordered_at && (
                            <div className="text-[11px] text-text-subtle">{formatDate(order.ordered_at)}</div>
                        )}
                    </div>
                    <div className="h-10 w-10" />
                </div>
            </header>

            {/* Content */}
            <main className={cn(
                "mx-auto max-w-lg px-4 py-4",
                isTerminal ? "pb-[calc(8rem+env(safe-area-inset-bottom))]" : "pb-[calc(2rem+env(safe-area-inset-bottom))]"
            )}>
                {/* Status Badge */}
                <div className="flex items-center justify-center">
                    <OrderStatusBadge status={order.status} />
                </div>

                {/* Ready for Pickup - Hero Banner */}
                {isReadyForPickup && isPickup && (
                    <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                                <QrCode className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="text-xs font-medium text-blue-100">Siap Diambil</div>
                                <div className="mt-0.5 text-lg font-bold">Tunjukkan Kode Ini</div>
                            </div>
                        </div>
                        <div className="mt-4 rounded-xl bg-white/15 px-4 py-3 text-center backdrop-blur-sm">
                            <div className="text-3xl font-bold tracking-wider">{order.order_code}</div>
                        </div>
                        <div className="mt-3 text-center text-xs text-blue-100">
                            Tunjukkan kode ini ke kasir untuk mengambil pesanan
                        </div>
                    </div>
                )}

                {/* Delivery In Progress - Hero Banner */}
                {order.status === 'delivering' && order.delivery?.courier && (
                    <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                                <Truck className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="text-xs font-medium text-emerald-100">Dalam Perjalanan</div>
                                <div className="mt-0.5 text-lg font-bold">Kurir: {order.delivery.courier.name}</div>
                            </div>
                        </div>
                        {order.delivery.courier.phone && (
                            <a
                                href={`tel:${order.delivery.courier.phone}`}
                                className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/20 py-3 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/30"
                            >
                                <Phone className="h-4 w-4" />
                                Hubungi Kurir
                            </a>
                        )}
                    </div>
                )}

                {/* Tracking Link */}
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Link Pelacakan</div>
                    <div className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs font-semibold tabular-nums text-text break-all">
                        {trackingUrl}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={copyTrackingLink}
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-bold text-text transition-all active:scale-[0.98] active:bg-surface-muted"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            {copied ? 'Tersalin' : 'Salin'}
                        </button>
                        <button
                            type="button"
                            onClick={shareTrackingLink}
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-white transition-all active:scale-[0.98] active:bg-primary-hover"
                        >
                            <Share2 className="h-3.5 w-3.5" />
                            Share
                        </button>
                        <button
                            type="button"
                            onClick={shareViaWhatsApp}
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 transition-all active:scale-[0.98] active:bg-emerald-100"
                        >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WA
                        </button>
                    </div>
                </div>

                {/* Timeline */}
                <div className="mt-5 rounded-xl border border-border bg-white p-4">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-lg",
                            isPickup ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                        )}>
                            {isPickup ? <Store className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">
                            {isPickup ? 'Status Pengambilan' : 'Status Pengiriman'}
                        </span>
                    </div>
                    <div className="mt-4 space-y-0">
                        {steps.map((step, index) => {
                            const isStepCompleted = index < effectiveIndex;
                            const isCurrent = index === effectiveIndex;
                            const history = historyMap.get(step.key);
                            const isLast = index === steps.length - 1;
                            const Icon = step.icon;

                            return (
                                <div key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                                    {!isLast && (
                                        <div className={cn(
                                            "absolute left-[11px] top-6 bottom-0 w-px",
                                            isStepCompleted ? "bg-emerald-200" : "bg-border"
                                        )} />
                                    )}
                                    <div className="relative shrink-0 pt-0.5">
                                        {isStepCompleted ? (
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                            </div>
                                        ) : isCurrent ? (
                                            <div className={cn(
                                                "flex h-6 w-6 items-center justify-center rounded-full ring-2",
                                                isPickup ? "bg-blue-100 ring-blue-500" : "bg-emerald-100 ring-emerald-500"
                                            )}>
                                                <Icon className={cn("h-3 w-3", isPickup ? "text-blue-600" : "text-emerald-600")} />
                                            </div>
                                        ) : (
                                            <div className="flex h-6 w-6 items-center justify-center">
                                                <Circle className="h-3 w-3 text-text-subtle" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1 pt-0.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className={cn(
                                                    "text-sm font-semibold",
                                                    isCurrent ? (isPickup ? "text-blue-700" : "text-emerald-700") : isStepCompleted ? "text-text" : "text-text-subtle"
                                                )}>
                                                    {step.label}
                                                </div>
                                                {isCurrent && step.description && (
                                                    <div className="mt-0.5 text-xs text-text-muted">{step.description}</div>
                                                )}
                                            </div>
                                            {history?.created_at && (
                                                <span className={cn(
                                                    "shrink-0 text-xs tabular-nums",
                                                    isCurrent ? (isPickup ? "font-semibold text-blue-700" : "font-semibold text-emerald-700") : "text-text-subtle"
                                                )}>
                                                    {formatTime(history.created_at)}
                                                </span>
                                            )}
                                        </div>
                                        {history?.notes && (
                                            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">{history.notes}</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Rejection Reason */}
                {isRejected && order.rejection_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Alasan Ditolak</span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.rejection_reason}</div>
                        {order.rejection_note && (
                            <div className="mt-1 text-xs text-red-700">{order.rejection_note}</div>
                        )}
                    </div>
                )}

                {/* Cancellation Reason */}
                {isCancelled && order.cancellation_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Alasan Dibatalkan</span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-red-800">{order.cancellation_reason}</div>
                        {order.cancellation_note && (
                            <div className="mt-1 text-xs text-red-700">{order.cancellation_note}</div>
                        )}
                    </div>
                )}

                {/* Expired Reason */}
                {isExpired && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-600" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Pesanan Kadaluarsa</span>
                        </div>
                        <div className="mt-2 text-sm text-amber-800">Outlet tidak memberikan konfirmasi dalam batas waktu yang ditentukan.</div>
                    </div>
                )}

                {/* Outlet / Pickup Info */}
                {order.outlet && (
                    <div className="mt-4 rounded-xl border border-border bg-white p-4">
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-lg",
                                isPickup ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                            )}>
                                {isPickup ? <Store className="h-3.5 w-3.5" /> : <Navigation className="h-3.5 w-3.5" />}
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">
                                {isPickup ? 'Ambil di Outlet' : 'Kirim ke Alamat'}
                            </span>
                        </div>

                        <div className="mt-3 flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted">
                                <Store className="h-5 w-5 text-text-muted" />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-semibold text-text">{order.outlet.name}</div>
                                {order.outlet.address && (
                                    <div className="mt-0.5 text-xs text-text-muted">{order.outlet.address}</div>
                                )}
                            </div>
                        </div>

                        {/* Pickup Instructions */}
                        {isPickup && (
                            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                                <div className="text-xs font-semibold text-blue-800">Cara Mengambil:</div>
                                <ol className="mt-2 space-y-1.5 text-xs text-blue-700">
                                    <li className="flex items-start gap-2">
                                        <span className="font-semibold text-blue-800">1.</span>
                                        <span>Datang ke outlet yang tertera di atas</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-semibold text-blue-800">2.</span>
                                        <span>Tunjukkan kode pesanan <span className="font-bold">{order.order_code}</span> ke kasir</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-semibold text-blue-800">3.</span>
                                        <span>Ambil pesanan Anda</span>
                                    </li>
                                </ol>
                            </div>
                        )}

                        {/* Delivery Address */}
                        {!isPickup && order.customer_address && (
                            <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
                                <div className="text-xs font-semibold text-purple-800">Alamat Pengiriman:</div>
                                <div className="mt-1 text-xs text-purple-700">{order.customer_address}</div>
                            </div>
                        )}

                        {/* Courier Info */}
                        {!isPickup && order.delivery?.courier && (
                            <div className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                                    <UserCheck className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-medium text-emerald-700">Kurir</div>
                                    <div className="text-sm font-semibold text-emerald-900">{order.delivery.courier.name}</div>
                                </div>
                                {order.delivery.courier.phone && (
                                    <a
                                        href={`tel:${order.delivery.courier.phone}`}
                                        className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 transition-colors active:bg-emerald-300"
                                    >
                                        <Phone className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Order Summary */}
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-muted">
                            <Package className="h-3.5 w-3.5 text-text-muted" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Ringkasan Pesanan</span>
                    </div>
                    <div className="mt-3 space-y-2">
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
                    <div className="mt-3 border-t border-border pt-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-text">Total</span>
                            <span className="text-lg font-bold tabular-nums text-primary">{formatCurrency(order.total)}</span>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                {notifications.length > 0 && (
                    <div className="mt-4 rounded-xl border border-border bg-white p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Riwayat Notifikasi</div>
                        <div className="mt-3 space-y-3">
                            {notifications.map((notification) => (
                                <div key={notification.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                                        <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-text">{notification.title}</div>
                                        <div className="mt-0.5 text-xs text-text-muted">{notification.message}</div>
                                        <div className="mt-1 text-[10px] text-text-subtle">{notification.time_ago}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Account Promotion */}
                {canCreateAccount && accountPhone && (
                    <AccountPromotionBanner phone={accountPhone} name={accountName} />
                )}

                {/* Dombi branding */}
                <div className="mt-8 text-center">
                    <p className="text-[11px] text-text-subtle">Powered by</p>
                    <p className="text-sm font-bold text-text-muted">Dombi</p>
                </div>
            </main>

            {/* Sticky CTA for terminal orders */}
            {isTerminal && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
                    <div className="mx-auto max-w-lg space-y-2">
                        {!isCancelled && !isRejected && (
                            <a
                                href={`/customer/orders/${order.id}/restore-cart`}
                                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-primary-hover"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Pesan Lagi
                            </a>
                        )}
                        <Link
                            href="/customer/home"
                            className="flex min-h-10 w-full items-center justify-center text-xs font-bold uppercase tracking-wide text-text-muted transition-colors active:text-text"
                        >
                            Kembali ke Beranda
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

function formatTime(value: string): string {
    try {
        return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
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
                body: JSON.stringify({
                    phone,
                    name: formName,
                    password,
                    password_confirmation: passwordConfirmation,
                }),
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
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Buat Akun</div>
            <div className="mt-2 text-sm text-emerald-800">
                Buat akun untuk melacak pesanan, menyimpan alamat, dan memesan lebih mudah.
            </div>

            {!showForm ? (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-emerald-700"
                >
                    Buat Akun Sekarang
                </button>
            ) : (
                <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Nomor HP (terverifikasi)</label>
                        <div className="mt-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700">
                            {maskedPhone}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-emerald-700">Nama</label>
                        <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            required
                            minLength={3}
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
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
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
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
                            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        />
                    </div>

                    {error && (
                        <p className="text-sm font-medium text-red-600">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-emerald-700 disabled:opacity-50"
                    >
                        {loading ? 'Membuat Akun...' : 'Daftar'}
                    </button>
                </form>
            )}
        </div>
    );
}
