import { Head, Link, router, useForm } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ChevronLeft, Clock, Copy, MapPin, Navigation, Package, Phone, RotateCcw, Share2, Store, XCircle, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import OrderQRCard from '@/components/customer/order-qr-card';
import OrderTimeline from '@/components/customer/order-timeline';
import OfflineBanner from '@/components/offline-banner';
import StatusBadge from '@/components/ui/status-badge';
import Dialog from '@/components/ui/dialog';
import BottomSheet from '@/components/ui/bottom-sheet';
import { formatCurrency, formatDate } from '@/lib/format';
import { useOrderRecovery } from '@/lib/order-recovery';

const REPORT_TYPES = [
    { value: 'not_received', label: 'Barang tidak diterima' },
    { value: 'wrong_items', label: 'Barang salah' },
    { value: 'damaged', label: 'Barang rusak/cacat' },
    { value: 'other', label: 'Lainnya' },
];

const REPORT_STATUS_LABELS: Record<string, { label: string; variant: string }> = {
    pending: { label: 'Menunggu Tinjauan', variant: 'warning' },
    investigating: { label: 'Sedang Ditinjau', variant: 'info' },
    resolved: { label: 'Telah Diselesaikan', variant: 'success' },
    rejected: { label: 'Tidak Dapat Diproses', variant: 'danger' },
};

const CANCELLABLE_STATUSES = ['pending_confirmation', 'confirmed', 'preparing'];

const STATUS_GUIDANCE: Record<string, { description: string; nextStep?: string; cta?: { label: string; href?: string; action?: string } }> = {
    pending_confirmation: {
        description: 'Menunggu outlet mengkonfirmasi pesanan Anda',
        nextStep: 'Biasanya dikonfirmasi dalam beberapa menit',
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
    out_for_delivery: {
        description: 'Kurir sedang dalam perjalanan',
        nextStep: 'Pesanan akan diantar ke lokasi Anda',
    },
    completed: {
        description: 'Pesanan telah selesai',
        nextStep: 'Terima kasih sudah pesan di Dombi!',
        cta: { label: 'Pesan Lagi', href: '/customer/products' },
    },
    rejected_by_outlet: {
        description: 'Outlet tidak dapat memproses pesanan',
        nextStep: 'Silakan coba pesan dari outlet lain',
        cta: { label: 'Pesan Lagi', href: '/customer/products' },
    },
    cancelled_by_customer: {
        description: 'Pesanan telah Anda batalkan',
        cta: { label: 'Pesan Lagi', href: '/customer/products' },
    },
    cancelled_by_outlet: {
        description: 'Pesanan dibatalkan oleh outlet',
        nextStep: 'Silakan coba pesan lagi',
        cta: { label: 'Pesan Lagi', href: '/customer/products' },
    },
    failed_delivery: {
        description: 'Pengiriman gagal',
        nextStep: 'Silakan hubungi kami untuk bantuan',
        cta: { label: 'Hubungi WhatsApp', action: 'wa_outlet' },
    },
    expired: {
        description: 'Pesanan kadaluarsa',
        nextStep: 'Outlet tidak konfirmasi dalam batas waktu',
        cta: { label: 'Pesan Lagi', href: '/customer/products' },
    },
};

export default function OrderShow({ order, cancellationReasons = [], isConfirmation = false, activeReport = null, hasRecentReport = false, canReport = false }: any) {
    const isTerminal = ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'].includes(order.status);
    const isPending = order.status === 'pending_confirmation';
    const isPickup = order.fulfillment_type === 'pickup';
    const isCancellable = CANCELLABLE_STATUSES.includes(order.status);
    const { addOrder } = useOrderRecovery();
    const [copied, setCopied] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [cancelLast4Hp, setCancelLast4Hp] = useState('');
    const [reportSheetOpen, setReportSheetOpen] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const cancelForm = useForm({ reason: '', note: '' });
    const reportForm = useForm({ type: '', notes: '' });

    useEffect(() => {
        if (order.customer_phone && order.order_code) {
            addOrder(order.customer_phone, order.order_code);
        }
    }, [order.customer_phone, order.order_code, addOrder]);

    const trackingUrl = order.tracking_url
        ?? (order.recovery_token ? `${window.location.origin}/track/${order.recovery_token}` : null);

    function handleCopy() {
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
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }
    }

    async function handleCancel() {
        if (isConfirmation && order.recovery_token) {
            try {
                const response = await fetch(`/track/${order.recovery_token}/cancel`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                    },
                    body: JSON.stringify({
                        reason: cancelForm.data.reason,
                        note: cancelForm.data.note || null,
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
            }

            return;
        }

        cancelForm.post(`/customer/orders/${order.id}/cancel`, {
            onSuccess: () => setCancelDialogOpen(false),
        });
    }

    async function handleReport() {
        if (!reportForm.data.type) return;

        setReportError(null);

        try {
            const response = await fetch(`/customer/orders/${order.id}/report`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({
                    type: reportForm.data.type,
                    notes: reportForm.data.notes || null,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setReportSheetOpen(false);
                reportForm.reset();
                // Reload to get updated report status from server
                router.reload({ only: ['activeReport', 'hasRecentReport', 'canReport'] });
            } else {
                setReportError(data.error || 'Gagal mengirim laporan.');
            }
        } catch {
            setReportError('Gagal mengirim laporan. Periksa koneksi Anda.');
        }
    }

    return (
        <div className="min-h-dvh bg-surface">
            <Head title={`Pesanan ${order.order_code}`} />
            <OfflineBanner />

            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)]">
                <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                    <button
                        type="button"
                        onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/customer/orders'}
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
                    <StatusBadge status={order.status} />
                </div>

                {/* What's Next Guidance */}
                {STATUS_GUIDANCE[order.status] && (() => {
                    const guidance = STATUS_GUIDANCE[order.status];
                    const isPickupReady = order.status === 'ready_for_pickup' && order.outlet?.latitude && order.outlet?.longitude;

                    return (
                        <div className="mt-3 rounded-xl border border-border bg-white p-4">
                            <div className="text-sm font-semibold text-text">{guidance.description}</div>
                            {guidance.nextStep && (
                                <div className="mt-1 text-xs text-text-muted">{guidance.nextStep}</div>
                            )}
                            {guidance.cta && (
                                <div className="mt-3">
                                    {isPickupReady && guidance.cta.action === 'navigate' ? (
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${order.outlet.latitude},${order.outlet.longitude}`}
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

                {/* QR Code — pickup ready */}
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
                        <Link
                            href={`/customer/orders/${order.id}/restore-cart`}
                            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-bold text-white active:opacity-80"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Pesan Lagi
                        </Link>
                    </div>
                )}

                {/* Recovery Token — hidden when completed */}
                {!isTerminal && order.recovery_token && (
                    <div className="mt-4 rounded-xl border border-border bg-white p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">Kode Pelacakan</div>
                                <div className="mt-1 text-xl font-bold tabular-nums tracking-wider text-text">{order.recovery_token}</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-white active:opacity-80"
                            >
                                {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Tersalin' : 'Salin'}
                            </button>
                        </div>
                        {trackingUrl && (
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold text-text active:opacity-80"
                                >
                                    <Share2 className="h-4 w-4" />
                                    Kirim ke WhatsApp
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Timeline */}
                <div className="mt-4">
                    <OrderTimeline
                        currentStatus={order.status}
                        histories={order.status_histories}
                        fulfillmentType={order.fulfillment_type}
                        defaultCollapsed
                    />
                </div>

                {/* Pesanan — items + info gabung */}
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-text-subtle" />
                        <span className="text-[13px] text-text-subtle">Pesanan</span>
                    </div>
                    <div className="space-y-2">
                        {order.items.map((item: any, index: number) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                                <div className="min-w-0">
                                    <span className="text-text">{item.product_name}</span>
                                    <span className="ml-1 text-xs text-text-subtle">x{item.quantity}</span>
                                </div>
                                <span className="shrink-0 font-medium tabular-nums text-text">{formatCurrency(item.subtotal)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 border-t border-border pt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-text-muted">
                            <span>Metode</span>
                            <span className="font-medium text-text">{isPickup ? 'Ambil di Outlet' : 'Kirim ke Alamat'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-text-muted">
                            <span>Pembayaran</span>
                            <span className="font-medium text-text">{order.payment_method === 'cod' ? 'Bayar di Tempat' : order.payment_method}</span>
                        </div>
                        {Number(order.delivery_fee) > 0 && (
                            <div className="flex items-center justify-between text-xs text-text-muted">
                                <span>Ongkir</span>
                                <span className="font-medium text-text">{formatCurrency(order.delivery_fee)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between text-sm font-semibold text-text pt-1 border-t border-border">
                            <span>Total</span>
                            <span className="tabular-nums">{formatCurrency(order.total)}</span>
                        </div>
                    </div>
                </div>

                {/* Outlet — kompres */}
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
                                    Hubungi
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Delivery Address — kompres */}
                {!isPickup && order.customer_address && (
                    <div className="mt-4 rounded-xl border border-border bg-white p-4">
                        <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-subtle" />
                            <div className="min-w-0 flex-1">
                                <div className="line-clamp-2 text-sm font-medium text-text">{order.customer_address}</div>
                                {order.customer_address_detail && (
                                    <div className="mt-1 text-xs text-text-muted">Detail: {order.customer_address_detail}</div>
                                )}
                            </div>
                        </div>
                        {order.latitude && order.longitude && (
                            <a
                                href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border text-xs font-semibold text-text active:opacity-80"
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                Buka di Maps
                            </a>
                        )}
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

                {/* Failed Delivery */}
                {order.delivery?.failed_reason && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <div className="text-[13px] text-amber-700">Pengiriman Gagal</div>
                        </div>
                        <div className="mt-2 text-sm text-amber-800">{order.delivery.failed_reason}</div>
                    </div>
                )}

                {/* Rejection */}
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

                {/* Cancelled */}
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

                {/* Expired */}
                {order.status === 'expired' && (
                    <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-text-muted" />
                            <div className="text-[13px] text-text">Pesanan Kadaluarsa</div>
                        </div>
                        <div className="mt-2 text-sm text-text-muted">Outlet tidak memberikan konfirmasi dalam batas waktu.</div>
                    </div>
                )}

                {/* Cancel Button */}
                {isCancellable && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => setCancelDialogOpen(true)}
                            className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 text-sm font-semibold text-red-600 active:opacity-80"
                        >
                            Batalkan Pesanan
                        </button>
                        <p className="mt-2 text-center text-[11px] text-text-subtle">Batalkan hanya jika pesanan belum diproses</p>
                    </div>
                )}

                {/* Non-cancellable */}
                {!isCancellable && !isTerminal && (
                    <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-center">
                        <div className="text-sm text-text-muted">Pesanan sedang diproses dan tidak dapat dibatalkan.</div>
                        {order.outlet?.phone && (
                            <a href={`https://wa.me/${order.outlet.phone.replace(/^0/, '62')}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary active:opacity-80">
                                <Phone className="h-3.5 w-3.5" />
                                Hubungi Outlet
                            </a>
                        )}
                    </div>
                )}

                {/* Reorder — for non-completed terminal states */}
                {isTerminal && order.status !== 'completed' && (
                    <div className="mt-6">
                        <Link href={`/customer/orders/${order.id}/restore-cart`} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white active:opacity-80">
                            <RotateCcw className="h-4 w-4" />
                            Pesan Lagi
                        </Link>
                    </div>
                )}

                {/* Report Status — show if report exists */}
                {hasRecentReport && activeReport && (() => {
                    const reportStatus = REPORT_STATUS_LABELS[activeReport.status] ?? { label: activeReport.status, variant: 'neutral' };
                    const isResolved = activeReport.status === 'resolved' || activeReport.status === 'rejected';

                    return (
                        <div className="mt-4 rounded-xl border border-border bg-white p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[13px] text-text-subtle">Laporan Anda</span>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                    reportStatus.variant === 'success' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                                    reportStatus.variant === 'danger' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' :
                                    reportStatus.variant === 'info' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' :
                                    'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                }`}>
                                    {reportStatus.label}
                                </span>
                            </div>
                            <div className="mt-1.5 text-sm text-text">{activeReport.type_label}</div>
                            {isResolved && activeReport.resolution_notes && (
                                <div className="mt-2 rounded-lg bg-surface-muted p-3 text-xs text-text-muted">
                                    <span className="font-semibold text-text">Resolusi: </span>{activeReport.resolution_notes}
                                </div>
                            )}
                            {!isResolved && (
                                <div className="mt-2 text-xs text-text-subtle">Kami akan mengabari Anda setelah laporan ditinjau.</div>
                            )}
                        </div>
                    );
                })()}

                {/* Report Button */}
                {canReport && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => setReportSheetOpen(true)}
                            className="flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-semibold text-text active:opacity-80"
                        >
                            <AlertTriangle className="mr-2 h-4 w-4 text-text-muted" />
                            Laporkan Masalah
                        </button>
                    </div>
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

                {isPickup && isConfirmation && (
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
                            onClick={() => cancelForm.setData('reason', reason)}
                            className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${
                                cancelForm.data.reason === reason
                                    ? 'border-primary bg-primary-light text-primary'
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
                            className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                    </div>
                )}

                {cancelError && <p className="mt-2 text-sm font-medium text-red-600">{cancelError}</p>}
                {cancelForm.errors.reason && <p className="mt-2 text-xs text-red-600">{cancelForm.errors.reason}</p>}
                {cancelForm.errors.note && <p className="mt-1 text-xs text-red-600">{cancelForm.errors.note}</p>}

                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => { setCancelDialogOpen(false); setCancelLast4Hp(''); setCancelError(null); }}
                        className="flex h-12 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold text-text active:opacity-80"
                    >
                        Kembali
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={!cancelForm.data.reason || cancelForm.processing || (isPickup && isConfirmation && cancelLast4Hp.length !== 4)}
                        className="flex h-12 flex-1 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle"
                    >
                        {cancelForm.processing ? 'Membatalkan...' : 'Ya, Batalkan'}
                    </button>
                </div>
            </Dialog>

            {/* Report Sheet */}
            <BottomSheet open={reportSheetOpen} onClose={() => { setReportSheetOpen(false); setReportError(null); reportForm.reset(); }} title="Laporkan Masalah">
                <p className="text-sm text-text-muted">Pilih jenis masalah yang Anda alami.</p>

                <div className="mt-4 space-y-2">
                    {REPORT_TYPES.map((type) => (
                        <button
                            key={type.value}
                            type="button"
                            onClick={() => reportForm.setData('type', type.value)}
                            className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${
                                reportForm.data.type === type.value
                                    ? 'border-primary bg-primary-light text-primary'
                                    : 'border-border text-text active:opacity-80'
                            }`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>

                <div className="mt-3">
                    <textarea
                        value={reportForm.data.notes}
                        onChange={(e) => reportForm.setData('notes', e.target.value)}
                        placeholder="Jelaskan masalah Anda (opsional)..."
                        className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                </div>

                {reportError && <p className="mt-2 text-sm font-medium text-red-600">{reportError}</p>}

                <button
                    type="button"
                    onClick={handleReport}
                    disabled={!reportForm.data.type || reportForm.processing}
                    className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80 disabled:bg-surface-muted disabled:text-text-subtle"
                >
                    {reportForm.processing ? 'Mengirim...' : 'Kirim Laporan'}
                </button>
            </BottomSheet>
        </div>
    );
}
